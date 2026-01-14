from django.db.models.signals import post_save
from django.dispatch import receiver
from forms.models import FormSubmission
from transport_planning.models import ServiceApplication, TransportService, Person
from transport_planning.services import evaluate_eligibility


@receiver(post_save, sender=FormSubmission)
def create_service_application_from_submission(sender, instance: FormSubmission, created: bool, **kwargs):
    """
    When a form submission is created for a transport service template, create a ServiceApplication.
    """
    if not created:
        return
    try:
        service = TransportService.objects.get(form_template=instance.form_template, active=True)
    except TransportService.DoesNotExist:
        return
    cpf = instance.cpf
    municipality = instance.municipality
    person, _ = Person.objects.get_or_create(
        municipality=municipality,
        cpf=cpf,
        defaults={"full_name": cpf, "status": Person.Status.ACTIVE},
    )
    status, notes = evaluate_eligibility(service, None)
    ServiceApplication.objects.create(
        municipality=municipality,
        person=person,
        transport_service=service,
        form_submission=instance,
        status=status,
        status_notes=notes,
    )


@receiver(post_save, sender="transport_planning.Assignment")
def create_trip_from_assignment(sender, instance, created, **kwargs):
    """
    When an Assignment is confirmed, create a corresponding Trip.
    """
    from transport_planning.models import Assignment
    from trips.models import Trip
    from datetime import datetime, timedelta

    if instance.status != Assignment.Status.CONFIRMED:
        return

    # If already has a trip, do nothing (or update? for now, nothing)
    if instance.generated_trip:
        return

    route = instance.route
    date_val = instance.date
    
    # Determine start/end times
    start_time = route.time_window_start or datetime.min.time()
    # Combine date + time
    # Note: timezone handling is important. We use the current timezone.
    from django.utils import timezone
    tz = timezone.get_current_timezone()
    
    departure_dt = timezone.make_aware(datetime.combine(date_val, start_time), tz)
    
    if route.time_window_end:
        return_dt = timezone.make_aware(datetime.combine(date_val, route.time_window_end), tz)
    elif route.estimated_duration_minutes:
        return_dt = departure_dt + timedelta(minutes=route.estimated_duration_minutes)
    else:
        # Default to 1 hour if no info
        return_dt = departure_dt + timedelta(hours=1)

    # Determine Origin/Destination from stops
    # We need to fetch stops. Since we are in a signal, we can query.
    stops = route.stops.all().order_by("order")
    origin = route.name  # Default
    destination = route.name # Default
    
    if stops.exists():
        first = stops.first()
        last = stops.last()
        origin = first.description
        destination = last.description

    # Create Trip
    trip = Trip.objects.create(
        municipality=instance.municipality,
        vehicle=instance.vehicle,
        driver=instance.driver,
        origin=origin,
        destination=destination,
        departure_datetime=departure_dt,
        return_datetime_expected=return_dt,
        status=Trip.Status.PLANNED,
        category=Trip.Category.PASSENGER, # Default
        contract=route.contract,
        notes=f"Gerado automaticamente da escala: {route.code}",
    )

    # Link back without triggering recursion (update_fields)
    instance.generated_trip = trip
    instance.save(update_fields=["generated_trip"])

