from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from maintenance.models import MaintenancePlan, ServiceOrder, Tire, VehicleTire


@transaction.atomic
def handle_trip_completion(vehicle, distance_km: int):
    if distance_km is None or distance_km <= 0:
        return
    _update_tires(vehicle, distance_km)
    _create_preventive_if_needed(vehicle)


def _create_preventive_if_needed(vehicle):
    today = timezone.localdate()
    plans = MaintenancePlan.objects.filter(vehicle=vehicle, is_active=True)
    for plan in plans:
        due = False
        if plan.trigger_type == MaintenancePlan.TriggerType.KM:
            last_odometer = plan.last_service_odometer or vehicle.odometer_initial
            if plan.interval_km and vehicle.odometer_current - last_odometer >= plan.interval_km:
                due = True
        elif plan.trigger_type == MaintenancePlan.TriggerType.TIME:
            last_date = plan.last_service_date or vehicle.last_service_date
            if plan.interval_days and last_date:
                due = (today - last_date).days >= plan.interval_days
            elif plan.interval_days and not last_date:
                due = True
        if due:
            _create_preventive_order(vehicle, plan)


def _create_preventive_order(vehicle, plan):
    already_open = ServiceOrder.objects.filter(
        vehicle=vehicle,
        type=ServiceOrder.Type.PREVENTIVE,
        status__in=[ServiceOrder.Status.OPEN, ServiceOrder.Status.IN_PROGRESS, ServiceOrder.Status.WAITING_PARTS],
    ).exists()
    if already_open:
        return
    ServiceOrder.objects.create(
        municipality=vehicle.municipality,
        vehicle=vehicle,
        type=ServiceOrder.Type.PREVENTIVE,
        priority=ServiceOrder.Priority.MEDIUM,
        status=ServiceOrder.Status.OPEN,
        description="Manutenção preventiva programada",
        vehicle_odometer_open=vehicle.odometer_current,
    )


def _update_tires(vehicle, distance_km: int):
    active_positions = VehicleTire.objects.filter(vehicle=vehicle, active=True).select_related("tire")
    for vt in active_positions:
        tire = vt.tire
        tire.total_km += distance_km
        tire.km_since_last_retread += distance_km
        tire.save(update_fields=["total_km", "km_since_last_retread", "updated_at"])
        if tire.max_km_life and tire.total_km >= tire.max_km_life:
            _create_tire_alert(vehicle, tire)


def _create_tire_alert(vehicle, tire: Tire):
    has_open = ServiceOrder.objects.filter(
        vehicle=vehicle,
        type=ServiceOrder.Type.TIRE,
        status__in=[ServiceOrder.Status.OPEN, ServiceOrder.Status.IN_PROGRESS, ServiceOrder.Status.WAITING_PARTS],
    ).exists()
    if has_open:
        return
    ServiceOrder.objects.create(
        municipality=vehicle.municipality,
        vehicle=vehicle,
        type=ServiceOrder.Type.TIRE,
        priority=ServiceOrder.Priority.HIGH,
        status=ServiceOrder.Status.OPEN,
        description=f"Alerta de pneu {tire.code} próximo do fim de vida",
        vehicle_odometer_open=vehicle.odometer_current,
    )
