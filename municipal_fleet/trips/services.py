from datetime import date, datetime, timedelta
from django.db import transaction
from django.utils import timezone
from trips.models import PlannedTrip, TripExecution, TripExecutionStop, TripManifest, TripManifestPassenger
from trips.routing import optimize_destinations, build_route_geometry, route_summary


def _combine_datetime(target_date: date, target_time) -> datetime:
    dt = datetime.combine(target_date, target_time)
    if timezone.is_aware(timezone.now()):
        return timezone.make_aware(dt)
    return dt


def _month_safe_date(year: int, month: int, day: int) -> date:
    try:
        return date(year, month, day)
    except ValueError:
        # fallback to last day of month
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        return next_month - timedelta(days=1)


def _add_months(base_date: date, months: int) -> date:
    month_index = (base_date.month - 1) + months
    year = base_date.year + (month_index // 12)
    month = (month_index % 12) + 1
    return _month_safe_date(year, month, base_date.day)


def _recurrence_dates(plan: PlannedTrip, start: date, end: date):
    final = end if plan.end_date is None else min(plan.end_date, end)
    if plan.recurrence == PlannedTrip.Recurrence.NONE:
        if plan.start_date >= start and plan.start_date <= final:
            return [plan.start_date]
        return []

    dates = []
    current = plan.start_date
    while current < start:
        if plan.recurrence == PlannedTrip.Recurrence.WEEKLY:
            current += timedelta(weeks=1)
        elif plan.recurrence == PlannedTrip.Recurrence.MONTHLY:
            current = _add_months(current, 1)
        elif plan.recurrence == PlannedTrip.Recurrence.QUARTERLY:
            current = _add_months(current, 3)
        elif plan.recurrence == PlannedTrip.Recurrence.YEARLY:
            current = _add_months(current, 12)
        else:
            return dates

    while current <= final:
        dates.append(current)
        if plan.recurrence == PlannedTrip.Recurrence.WEEKLY:
            current += timedelta(weeks=1)
        elif plan.recurrence == PlannedTrip.Recurrence.MONTHLY:
            current = _add_months(current, 1)
        elif plan.recurrence == PlannedTrip.Recurrence.QUARTERLY:
            current = _add_months(current, 3)
        elif plan.recurrence == PlannedTrip.Recurrence.YEARLY:
            current = _add_months(current, 12)
        else:
            break
    return dates


@transaction.atomic
def generate_executions(plan: PlannedTrip, start: date, end: date):
    if not plan.vehicle or not plan.driver:
        raise ValueError("Plano precisa de veículo e motorista para gerar execuções.")
    dates = _recurrence_dates(plan, start, end)
    created = []
    for scheduled_date in dates:
        departure = _combine_datetime(scheduled_date, plan.departure_time)
        return_dt = _combine_datetime(scheduled_date, plan.return_time_expected)
        if return_dt <= departure:
            return_dt += timedelta(days=1)

        if TripExecution.objects.filter(planned_trip=plan, scheduled_departure=departure).exists():
            continue

        execution = TripExecution.objects.create(
            municipality=plan.municipality,
            planned_trip=plan,
            module=plan.module,
            vehicle=plan.vehicle,
            driver=plan.driver,
            scheduled_departure=departure,
            scheduled_return=return_dt,
            planned_capacity=plan.planned_capacity,
        )

        stops = list(plan.stops.select_related("destination").order_by("order"))
        destinations = [stop.destination for stop in stops]
        if destinations:
            ordered_destinations = optimize_destinations(destinations) if plan.optimize_route else destinations
            distance_km, duration_minutes = route_summary(ordered_destinations)
            execution.route_geometry = build_route_geometry(ordered_destinations)
            execution.route_distance_km = round(distance_km, 2)
            execution.route_duration_minutes = duration_minutes
            execution.save(update_fields=["route_geometry", "route_distance_km", "route_duration_minutes"])
            for idx, destination in enumerate(ordered_destinations):
                TripExecutionStop.objects.create(
                    trip_execution=execution,
                    destination=destination,
                    order=idx + 1,
                )

        manifest = TripManifest.objects.create(trip_execution=execution, total_passengers=0)
        passenger_items = list(plan.passengers.all())
        for passenger in passenger_items:
            TripManifestPassenger.objects.create(
                manifest=manifest,
                passenger_type=passenger.passenger_type,
                student=passenger.student,
                patient=passenger.patient,
                companion=passenger.companion,
                linked_patient=passenger.patient if passenger.passenger_type == passenger.PassengerType.COMPANION else None,
                notes=passenger.notes,
            )
        if passenger_items:
            manifest.total_passengers = len(passenger_items)
            manifest.save(update_fields=["total_passengers"])
        created.append(execution)
    return created
