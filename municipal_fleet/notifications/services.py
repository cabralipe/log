from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone

from accounts.models import User
from drivers.models import Driver
from maintenance.models import ServiceOrder
from notifications.models import Notification
from transport_planning.models import Assignment

CNH_ALERT_DAYS = 30
MAINTENANCE_ALERT_DAYS = 7
TRIP_REMINDER_MINUTES = 60
GEOFENCE_RADIUS_KM = Decimal("0.5")
GEOFENCE_COOLDOWN_MINUTES = 15


def create_notification(
    *,
    municipality,
    event_type: str,
    title: str,
    message: str,
    channel: Notification.Channel,
    recipient_user=None,
    recipient_driver=None,
    metadata=None,
):
    payload = {
        "municipality": municipality,
        "recipient_user": recipient_user,
        "recipient_driver": recipient_driver,
        "event_type": event_type,
        "title": title,
        "message": message,
        "channel": channel,
        "metadata": metadata or {},
    }
    return Notification.objects.create(**payload)


def send_email_notification(notification: Notification) -> None:
    if notification.channel != Notification.Channel.EMAIL:
        return
    recipient = notification.recipient_user
    if not recipient or not recipient.email:
        return
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@municipal-fleet.local")
    try:
        send_mail(
            notification.title,
            notification.message,
            from_email,
            [recipient.email],
            fail_silently=False,
        )
        notification.sent_at = timezone.now()
        notification.delivery_error = ""
        notification.save(update_fields=["sent_at", "delivery_error"])
    except Exception as exc:  # noqa: BLE001
        notification.delivery_error = str(exc)
        notification.save(update_fields=["delivery_error"])


def _already_notified(event_type: str, metadata: dict, since: timedelta) -> bool:
    cutoff = timezone.now() - since
    qs = Notification.objects.filter(event_type=event_type, created_at__gte=cutoff)
    for key, value in (metadata or {}).items():
        qs = qs.filter(metadata__has_key=key).filter(metadata__contains={key: value})
    return qs.exists()


def dispatch_cnh_expiration_alerts():
    today = timezone.localdate()
    limit = today + timedelta(days=CNH_ALERT_DAYS)
    drivers = Driver.objects.filter(cnh_expiration_date__lte=limit)
    for driver in drivers.select_related("municipality"):
        metadata = {"driver_id": driver.id, "expires_at": str(driver.cnh_expiration_date)}
        if _already_notified("CNH_EXPIRING", metadata, timedelta(days=1)):
            continue
        title = "CNH próxima do vencimento"
        message = f"A CNH de {driver.name} vence em {driver.cnh_expiration_date:%d/%m/%Y}."
        create_notification(
            municipality=driver.municipality,
            recipient_driver=driver,
            event_type="CNH_EXPIRING",
            title=title,
            message=message,
            channel=Notification.Channel.PUSH,
            metadata=metadata,
        )
        admins = User.objects.filter(
            municipality=driver.municipality, role__in=[User.Roles.ADMIN_MUNICIPALITY, User.Roles.OPERATOR]
        )
        for admin in admins:
            notif = create_notification(
                municipality=driver.municipality,
                recipient_user=admin,
                event_type="CNH_EXPIRING",
                title=title,
                message=message,
                channel=Notification.Channel.EMAIL,
                metadata=metadata,
            )
            send_email_notification(notif)


def dispatch_maintenance_alerts():
    today = timezone.localdate()
    limit = today + timedelta(days=MAINTENANCE_ALERT_DAYS)
    vehicles = (
        ServiceOrder.objects.filter(status=ServiceOrder.Status.OPEN)
        .values_list("vehicle_id", flat=True)
        .distinct()
    )
    for vehicle_id in vehicles:
        metadata = {"vehicle_id": vehicle_id}
        if _already_notified("MAINTENANCE_PENDING", metadata, timedelta(days=1)):
            continue
        title = "Manutenção pendente"
        message = f"Há ordens de serviço abertas para o veículo #{vehicle_id}."
        _notify_admins(event_type="MAINTENANCE_PENDING", title=title, message=message, metadata=metadata)

    from fleet.models import Vehicle  # local import to avoid cycles

    due_vehicles = Vehicle.objects.filter(
        Q(next_service_date__lte=limit) | Q(next_oil_change_date__lte=limit)
    )
    for vehicle in due_vehicles:
        metadata = {"vehicle_id": vehicle.id, "license_plate": vehicle.license_plate}
        if _already_notified("MAINTENANCE_DUE", metadata, timedelta(days=1)):
            continue
        title = "Manutenção programada próxima"
        message = f"Veículo {vehicle.license_plate} com manutenção programada nos próximos dias."
        _notify_admins(
            municipality=vehicle.municipality,
            event_type="MAINTENANCE_DUE",
            title=title,
            message=message,
            metadata=metadata,
        )


def dispatch_trip_reminders():
    now = timezone.now()
    limit = now + timedelta(minutes=TRIP_REMINDER_MINUTES)
    assignments = Assignment.objects.filter(status=Assignment.Status.CONFIRMED, date__lte=limit.date())
    assignments = assignments.select_related("driver", "route", "municipality")
    for assignment in assignments:
        start, _ = assignment.estimated_period()
        if not start or not (now <= start <= limit):
            continue
        metadata = {"assignment_id": assignment.id, "start": start.isoformat()}
        if _already_notified("TRIP_REMINDER", metadata, timedelta(hours=4)):
            continue
        title = "Lembrete de viagem"
        message = f"Você tem uma viagem agendada ({assignment.route.code}) às {start:%H:%M}."
        create_notification(
            municipality=assignment.municipality,
            recipient_driver=assignment.driver,
            event_type="TRIP_REMINDER",
            title=title,
            message=message,
            channel=Notification.Channel.PUSH,
            metadata=metadata,
        )


def dispatch_geofence_alert(trip, ping):
    now = timezone.now()
    geofence = getattr(trip.driver, "geofence", None)
    if geofence:
        if not geofence.is_active:
            return False
        distance_km = _distance_km(float(ping.lat), float(ping.lng), float(geofence.center_lat), float(geofence.center_lng))
        outside = distance_km * 1000 > float(geofence.radius_m)
        if outside and not geofence.alert_active:
            geofence.alert_active = True
            geofence.last_alerted_at = now
            geofence.save(update_fields=["alert_active", "last_alerted_at", "updated_at"])
            metadata = {"trip_id": trip.id, "driver_id": trip.driver_id, "geofence_id": geofence.id}
            title = "Veículo fora do raio"
            message = f"O veículo {trip.vehicle.license_plate} saiu do raio definido."
            _notify_admins(
                municipality=trip.municipality,
                event_type="GEOFENCE_EXIT",
                title=title,
                message=message,
                metadata=metadata,
            )
        if not outside and geofence.alert_active:
            geofence.alert_active = False
            geofence.cleared_at = now
            geofence.save(update_fields=["alert_active", "cleared_at", "updated_at"])
            metadata = {"trip_id": trip.id, "driver_id": trip.driver_id, "geofence_id": geofence.id}
            title = "Veículo voltou ao raio"
            message = f"O veículo {trip.vehicle.license_plate} retornou ao raio definido."
            _notify_admins(
                municipality=trip.municipality,
                event_type="GEOFENCE_RETURN",
                title=title,
                message=message,
                metadata=metadata,
            )
        return geofence.alert_active

    assignment = trip.assignments.select_related("route").prefetch_related("route__stops").first()
    if not assignment:
        return False
    stops = [s for s in assignment.route.stops.all() if s.lat is not None and s.lng is not None]
    if not stops:
        return False
    distance = min(_distance_km(float(ping.lat), float(ping.lng), float(s.lat), float(s.lng)) for s in stops)
    if distance <= float(GEOFENCE_RADIUS_KM):
        return False
    metadata = {"trip_id": trip.id, "assignment_id": assignment.id}
    if _already_notified("GEOFENCE_EXIT", metadata, timedelta(minutes=GEOFENCE_COOLDOWN_MINUTES)):
        return True
    title = "Veículo fora da rota"
    message = f"O veículo {trip.vehicle.license_plate} saiu da rota planejada."
    _notify_admins(
        municipality=assignment.municipality,
        event_type="GEOFENCE_EXIT",
        title=title,
        message=message,
        metadata=metadata,
    )
    return True


def _notify_admins(*, municipality=None, event_type: str, title: str, message: str, metadata: dict):
    admins = User.objects.filter(
        municipality=municipality, role__in=[User.Roles.ADMIN_MUNICIPALITY, User.Roles.OPERATOR]
    )
    for admin in admins:
        notif = create_notification(
            municipality=municipality or admin.municipality,
            recipient_user=admin,
            event_type=event_type,
            title=title,
            message=message,
            channel=Notification.Channel.EMAIL,
            metadata=metadata,
        )
        send_email_notification(notif)


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import radians, sin, cos, sqrt, atan2

    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c
