from datetime import date, datetime, timedelta
from collections import Counter
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, F, ExpressionWrapper, IntegerField, Q, DurationField
from django.db.models.functions import TruncMonth, TruncYear
from django.utils import timezone
from rest_framework import permissions, response, views, status
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from fleet.models import Vehicle, FuelLog
from trips.models import (
    Trip,
    TripIncident,
    MonthlyOdometer,
    FreeTrip,
    TripExecution,
    TripManifest,
    TripManifestPassenger,
    PlannedTrip,
)
from contracts.models import Contract, RentalPeriod
from maintenance.models import ServiceOrder, MaintenancePlan, InventoryPart, InventoryMovement, Tire
from transport_planning.models import TransportService, Route, Assignment, ServiceApplication
from drivers.models import Driver
from forms.models import FormTemplate, FormSubmission, FormAnswer
from students.models import Student, StudentCard
from scheduling.models import DriverAvailabilityBlock

User = get_user_model()


def _parse_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _month_bounds(target: date):
    start = target.replace(day=1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month - timedelta(days=1)


def _quarter_bounds(target: date):
    quarter = ((target.month - 1) // 3) + 1
    start_month = (quarter - 1) * 3 + 1
    start = date(target.year, start_month, 1)
    if start_month == 10:
        next_quarter = date(target.year + 1, 1, 1)
    else:
        next_quarter = date(target.year, start_month + 3, 1)
    end = next_quarter - timedelta(days=1)
    return start, end


def _fuel_budget_status(municipality, qs):
    if not municipality:
        return None
    limit = getattr(municipality, "fuel_contract_limit", None)
    period = getattr(municipality, "fuel_contract_period", None)
    if not limit:
        return None
    today = timezone.localdate()
    if period == "WEEKLY":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == "QUARTERLY":
        start, end = _quarter_bounds(today)
    else:
        start, end = _month_bounds(today)
        period = "MONTHLY"
    spent = qs.filter(filled_at__gte=start, filled_at__lte=end).aggregate(total=Sum("total_cost"))["total"] or 0
    remaining = Decimal(limit) - Decimal(spent)
    percent = (Decimal(spent) / Decimal(limit) * Decimal("100")) if limit else Decimal("0")
    return {
        "limit": Decimal(limit),
        "period": period,
        "spent": Decimal(spent),
        "remaining": remaining,
        "percent": percent,
        "over_limit": remaining < 0,
        "period_start": start,
        "period_end": end,
    }


def _filter_odometer_range(qs, start: date | None, end: date | None):
    if start and end:
        qs = qs.filter(
            Q(year__gt=start.year) | Q(year=start.year, month__gte=start.month),
            Q(year__lt=end.year) | Q(year=end.year, month__lte=end.month),
        )
    elif start:
        qs = qs.filter(Q(year__gt=start.year) | Q(year=start.year, month__gte=start.month))
    elif end:
        qs = qs.filter(Q(year__lt=end.year) | Q(year=end.year, month__lte=end.month))
    return qs


def _percent_change(current: int, previous: int) -> int:
    if previous == 0:
        return 0 if current == 0 else 100
    return round(((current - previous) / previous) * 100)

def _format_decimal(value):
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral() else float(value)
    return value

class DashboardView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        today = timezone.localdate()
        now = timezone.now()
        month_start = today.replace(day=1)
        prev_month_end = month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1)
        week_start = today - timedelta(days=7)
        prev_week_start = today - timedelta(days=14)

        qs_vehicle = Vehicle.objects.all()
        qs_trip = Trip.objects.all()
        qs_driver = Driver.objects.all()
        qs_fuel = FuelLog.objects.all()
        qs_contract = Contract.objects.all()
        qs_rental = RentalPeriod.objects.all()
        qs_orders = ServiceOrder.objects.select_related("vehicle")
        qs_plans = MaintenancePlan.objects.select_related("vehicle")
        qs_parts = InventoryPart.objects.all()
        qs_tires = Tire.objects.all()
        qs_assignments = Assignment.objects.all()
        qs_services = TransportService.objects.all()
        qs_routes = Route.objects.all()
        qs_applications = ServiceApplication.objects.all()
        qs_templates = FormTemplate.objects.all()
        qs_submissions = FormSubmission.objects.all()
        qs_students = Student.objects.all()
        qs_cards = StudentCard.objects.all()
        qs_free_trips = FreeTrip.objects.select_related("vehicle", "driver")
        qs_incidents = TripIncident.objects.select_related("trip", "driver")
        odometer_month = MonthlyOdometer.objects.filter(year=now.year, month=now.month)
        qs_users = User.objects.all()

        if user.role != "SUPERADMIN":
            municipality_filter = {"municipality": user.municipality}
            qs_vehicle = qs_vehicle.filter(**municipality_filter)
            qs_trip = qs_trip.filter(**municipality_filter)
            qs_driver = qs_driver.filter(**municipality_filter)
            qs_fuel = qs_fuel.filter(**municipality_filter)
            qs_contract = qs_contract.filter(**municipality_filter)
            qs_rental = qs_rental.filter(**municipality_filter)
            qs_orders = qs_orders.filter(**municipality_filter)
            qs_plans = qs_plans.filter(**municipality_filter)
            qs_parts = qs_parts.filter(**municipality_filter)
            qs_tires = qs_tires.filter(**municipality_filter)
            qs_assignments = qs_assignments.filter(**municipality_filter)
            qs_services = qs_services.filter(**municipality_filter)
            qs_routes = qs_routes.filter(**municipality_filter)
            qs_applications = qs_applications.filter(**municipality_filter)
            qs_templates = qs_templates.filter(**municipality_filter)
            qs_submissions = qs_submissions.filter(**municipality_filter)
            qs_students = qs_students.filter(**municipality_filter)
            qs_cards = qs_cards.filter(**municipality_filter)
            qs_free_trips = qs_free_trips.filter(**municipality_filter)
            qs_incidents = qs_incidents.filter(**municipality_filter)
            odometer_month = odometer_month.filter(vehicle__municipality=user.municipality)
            qs_users = qs_users.filter(**municipality_filter)

        vehicles_total = qs_vehicle.count()
        drivers_active_count = qs_driver.filter(status=Driver.Status.ACTIVE).count()
        drivers_total = qs_driver.count()
        vehicle_status = qs_vehicle.values("status").annotate(total=Count("id"))
        ownership_stats = qs_vehicle.values("ownership_type").annotate(total=Count("id"))
        trips_month = qs_trip.filter(departure_datetime__month=now.month, departure_datetime__year=now.year)
        trips_month_total = trips_month.count()
        trips_prev_month_total = qs_trip.filter(
            departure_datetime__date__gte=prev_month_start,
            departure_datetime__date__lte=prev_month_end,
        ).count()
        trips_by_status = trips_month.values("status").annotate(total=Count("id"))
        passengers_month = trips_month.aggregate(total=Sum("passengers_count"))["total"] or 0

        incidents_last_30 = qs_incidents.filter(created_at__date__gte=today - timedelta(days=30))
        incidents_recent = incidents_last_30.values(
            "id",
            "trip_id",
            "trip__origin",
            "trip__destination",
            "driver__name",
            "created_at",
            "description",
        ).order_by("-created_at")[:6]

        free_trips_open = qs_free_trips.filter(status=FreeTrip.Status.OPEN)
        free_trips_recent = qs_free_trips.filter(status=FreeTrip.Status.CLOSED).order_by("-ended_at")[:6]

        maintenance_alerts = qs_vehicle.filter(
            Q(next_service_date__lte=today) | Q(next_oil_change_date__lte=today)
        ).values("id", "license_plate", "next_service_date", "next_oil_change_date")

        plans_due = []
        for plan in qs_plans.filter(is_active=True):
            km_since_last = None
            days_since_last = None
            due = False
            if plan.trigger_type == plan.TriggerType.KM and plan.interval_km and plan.vehicle:
                last = plan.last_service_odometer or 0
                km_since_last = (plan.vehicle.odometer_current or 0) - last
                if km_since_last >= plan.interval_km:
                    due = True
            if plan.trigger_type == plan.TriggerType.TIME and plan.interval_days and plan.last_service_date:
                days_since_last = (today - plan.last_service_date).days
                if days_since_last >= plan.interval_days:
                    due = True
            if due:
                plans_due.append(
                    {
                        "id": plan.id,
                        "name": plan.name,
                        "vehicle_plate": getattr(plan.vehicle, "license_plate", None),
                        "trigger_type": plan.trigger_type,
                        "km_since_last": km_since_last,
                        "days_since_last": days_since_last,
                        "interval_km": plan.interval_km,
                        "interval_days": plan.interval_days,
                    }
                )

        low_stock_parts = qs_parts.filter(current_stock__lte=F("minimum_stock")).values(
            "id", "name", "sku", "current_stock", "minimum_stock"
        )[:8]

        tires_nearing_end = []
        for tire in qs_tires:
            if tire.max_km_life and tire.total_km >= tire.max_km_life * 0.9:
                tires_nearing_end.append(
                    {
                        "id": tire.id,
                        "code": tire.code,
                        "brand": tire.brand,
                        "model": tire.model,
                        "total_km": tire.total_km,
                        "max_km_life": tire.max_km_life,
                        "status": tire.status,
                    }
                )

        fuel_month = qs_fuel.filter(filled_at__month=now.month, filled_at__year=now.year)
        fuel_month_liters = fuel_month.aggregate(total=Sum("liters"))["total"] or 0

        contracts_expiring_limit = today + timedelta(days=30)
        contracts_expiring = qs_contract.filter(end_date__lte=contracts_expiring_limit).values(
            "id", "contract_number", "provider_name", "end_date", "status"
        ).order_by("end_date")[:8]

        assignments_today = qs_assignments.filter(date=today)
        assignments_by_status = assignments_today.values("status").annotate(total=Count("id"))
        routes_without_assignment = qs_routes.filter(active=True).exclude(
            id__in=assignments_today.values_list("route_id", flat=True)
        ).count()

        applications_by_status = qs_applications.values("status").annotate(total=Count("id"))
        pending_applications = next(
            (item["total"] for item in applications_by_status if item["status"] == ServiceApplication.Status.PENDING),
            0,
        )
        submissions_by_status = qs_submissions.values("status").annotate(total=Count("id"))

        cards_by_status = qs_cards.values("status").annotate(total=Count("id"))
        cards_expiring_soon = qs_cards.filter(
            status=StudentCard.Status.ACTIVE, expiration_date__lte=today + timedelta(days=30)
        ).count()
        cards_issued_month = qs_cards.filter(
            issue_date__year=now.year, issue_date__month=now.month
        ).count()

        approved_card_submissions = qs_submissions.filter(
            form_template__form_type=FormTemplate.FormType.STUDENT_CARD_APPLICATION,
            status=FormSubmission.Status.APPROVED,
        )
        answers_qs = (
            FormAnswer.objects.filter(
                submission__in=approved_card_submissions,
                question__field_name__in=["shift", "course"],
            )
            .select_related("question")
            .prefetch_related("question__options")
        )
        shift_counts = Counter()
        course_counts = Counter()
        shift_label_map = {value: label for value, label in Student.Shift.choices}

        for ans in answers_qs:
            raw_value = ans.value_json if ans.value_json is not None else ans.value_text
            if raw_value in [None, "", []]:
                continue
            values = raw_value if isinstance(raw_value, list) else [raw_value]
            option_map = {opt.value: opt.label for opt in ans.question.options.all()}
            if ans.question.field_name == "shift":
                for value in values:
                    key = str(value)
                    label = option_map.get(key) or shift_label_map.get(key) or key
                    shift_counts[label] += 1
            if ans.question.field_name == "course":
                for value in values:
                    key = str(value)
                    label = option_map.get(key) or key
                    course_counts[label] += 1
        cnh_expiring_soon = qs_driver.filter(cnh_expiration_date__lte=today + timedelta(days=30)).values(
            "id", "name", "cnh_expiration_date"
        )[:6]

        odometer_month_data = list(
            odometer_month.values("vehicle_id", "vehicle__license_plate", "kilometers")
        )
        users_total = qs_users.count()
        users_by_role = qs_users.values("role").annotate(total=Count("id"))
        operators_total = qs_users.filter(role=User.Roles.OPERATOR).count()

        open_orders_qs = qs_orders.exclude(
            status__in=[ServiceOrder.Status.COMPLETED, ServiceOrder.Status.CANCELLED]
        )
        open_orders_week = open_orders_qs.filter(
            created_at__date__gte=week_start,
            created_at__date__lte=today,
        ).count()
        open_orders_prev_week = open_orders_qs.filter(
            created_at__date__gte=prev_week_start,
            created_at__date__lt=week_start,
        ).count()
        vehicles_prev_total = qs_vehicle.filter(created_at__date__lt=month_start).count()

        data = {
            "summary": {
                "total_vehicles": vehicles_total,
                "drivers_active": drivers_active_count,
                "trips_month_total": trips_month_total,
                "open_service_orders": open_orders_qs.count(),
                "fuel_month_liters": fuel_month_liters,
                "pending_applications": pending_applications,
                "trends": {
                    "vehicles_vs_prev_month": _percent_change(vehicles_total, vehicles_prev_total),
                    "trips_vs_prev_month": _percent_change(trips_month_total, trips_prev_month_total),
                    "open_service_orders_vs_prev_week": _percent_change(open_orders_week, open_orders_prev_week),
                },
            },
            "vehicles": {
                "total": vehicles_total,
                "by_status": list(vehicle_status),
                "by_ownership": list(ownership_stats),
                "maintenance_alerts": list(maintenance_alerts),
                "odometer_month": odometer_month_data,
            },
            "drivers": {
                "total": drivers_total,
                "active": drivers_active_count,
                "inactive": qs_driver.filter(status=Driver.Status.INACTIVE).count(),
                "free_trip_enabled": qs_driver.filter(free_trip_enabled=True).count(),
                "cnh_expiring_soon": list(cnh_expiring_soon),
            },
            "trips": {
                "month_total": trips_month_total,
                "by_status": list(trips_by_status),
                "passengers_month": passengers_month,
                "incidents_last_30d": incidents_last_30.count(),
                "incidents_recent": list(incidents_recent),
                "free_trips": {
                    "open_count": free_trips_open.count(),
                    "recent_closed": list(
                        free_trips_recent.values(
                            "id", "driver__name", "vehicle__license_plate", "odometer_start", "odometer_end", "ended_at"
                        )
                    ),
                },
            },
            "maintenance": {
                "service_orders_by_status": list(qs_orders.values("status").annotate(total=Count("id"))),
                "active_plans": qs_plans.filter(is_active=True).count(),
                "plans_due": plans_due[:8],
                "inventory_low_stock": list(low_stock_parts),
            },
            "contracts": {
                "total": qs_contract.count(),
                "active": qs_contract.filter(status=Contract.Status.ACTIVE).count(),
                "expiring_soon": list(contracts_expiring),
            },
            "rental_periods": {
                "by_status": list(qs_rental.values("status").annotate(total=Count("id"))),
            },
            "fuel": {
                "month_logs": fuel_month.count(),
                "month_liters": fuel_month_liters,
                "budget": _fuel_budget_status(user.municipality if user.role != "SUPERADMIN" else None, qs_fuel),
            },
            "transport_planning": {
                "services": qs_services.count(),
                "routes_active": qs_routes.filter(active=True).count(),
                "routes_inactive": qs_routes.filter(active=False).count(),
                "routes_without_assignment": routes_without_assignment,
                "assignments_today": list(assignments_by_status),
                "applications_by_status": list(applications_by_status),
            },
            "forms": {
                "templates_active": qs_templates.filter(is_active=True).count(),
                "submissions_by_status": list(submissions_by_status),
            },
            "students": {
                "total": qs_students.count(),
                "cards_active": qs_cards.filter(status=StudentCard.Status.ACTIVE).count(),
                "cards_expiring_soon": cards_expiring_soon,
                "cards_by_status": list(cards_by_status),
            },
            "student_cards": {
                "cards_total": qs_cards.count(),
                "cards_active": qs_cards.filter(status=StudentCard.Status.ACTIVE).count(),
                "cards_blocked": qs_cards.filter(status=StudentCard.Status.BLOCKED).count(),
                "cards_expired": qs_cards.filter(status=StudentCard.Status.EXPIRED).count(),
                "cards_replaced": qs_cards.filter(status=StudentCard.Status.REPLACED).count(),
                "cards_expiring_soon": cards_expiring_soon,
                "cards_issued_month": cards_issued_month,
                "approved_submissions": approved_card_submissions.count(),
                "cards_by_status": list(cards_by_status),
                "students_by_shift": [
                    {"name": name, "value": total} for name, total in shift_counts.most_common()
                ],
                "students_by_course": [
                    {"name": name, "value": total} for name, total in course_counts.most_common(8)
                ],
            },
            "tires": {
                "status_counts": list(qs_tires.values("status").annotate(total=Count("id"))),
                "nearing_end_of_life": tires_nearing_end[:8],
            },
            "users": {
                "total": users_total,
                "operators": operators_total,
                "by_role": list(users_by_role),
            },
            # compatibilidade com o payload antigo para nГЈo quebrar telas existentes
            "total_vehicles": vehicles_total,
            "vehicles_by_status": list(vehicle_status),
            "trips_month_total": trips_month_total,
            "trips_by_status": list(trips_by_status),
            "odometer_month": odometer_month_data,
            "maintenance_alerts": list(maintenance_alerts),
        }
        return response.Response(data)


class OdometerReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
            OpenApiParameter("vehicle_id", OpenApiTypes.INT, description="Vehicle ID"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        vehicle_id = request.query_params.get("vehicle_id")

        trips_qs = Trip.objects.all()
        if user.role != "SUPERADMIN":
            trips_qs = trips_qs.filter(municipality=user.municipality)
        if start_date:
            trips_qs = trips_qs.filter(departure_datetime__date__gte=start_date)
        if end_date:
            trips_qs = trips_qs.filter(departure_datetime__date__lte=end_date)
        if vehicle_id:
            trips_qs = trips_qs.filter(vehicle_id=vehicle_id)
        trips_qs = trips_qs.filter(status=Trip.Status.COMPLETED, odometer_end__isnull=False)
        distance_expr = ExpressionWrapper(F("odometer_end") - F("odometer_start"), output_field=IntegerField())
        aggregates = (
            trips_qs.values("vehicle_id", "vehicle__license_plate")
            .annotate(kilometers=Sum(distance_expr))
            .order_by("vehicle__license_plate")
        )
        return response.Response(list(aggregates))


class TripReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
            OpenApiParameter("driver_id", OpenApiTypes.INT, description="Driver ID"),
            OpenApiParameter("vehicle_id", OpenApiTypes.INT, description="Vehicle ID"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        qs = Trip.objects.select_related("vehicle", "driver")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        driver_id = request.query_params.get("driver_id")
        vehicle_id = request.query_params.get("vehicle_id")
        if start_date:
            qs = qs.filter(departure_datetime__date__gte=start_date)
        if end_date:
            qs = qs.filter(departure_datetime__date__lte=end_date)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)

        summary = {
            "total": qs.count(),
            "by_status": list(qs.values("status").annotate(total=Count("id"))),
            "total_passengers": qs.aggregate(total=Sum("passengers_count"))["total"] or 0,
        }
        trips_data = list(
            qs.values(
                "id",
                "origin",
                "destination",
                "status",
                "departure_datetime",
                "return_datetime_expected",
                "passengers_count",
                "category",
                "vehicle__license_plate",
                "driver__name",
            )
        )
        return response.Response({"summary": summary, "trips": trips_data})


class FuelReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
            OpenApiParameter("driver_id", OpenApiTypes.INT, description="Driver ID"),
            OpenApiParameter("vehicle_id", OpenApiTypes.INT, description="Vehicle ID"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        qs = FuelLog.objects.select_related("vehicle", "driver")
        qs_budget = FuelLog.objects.all()
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
            qs_budget = qs_budget.filter(municipality=user.municipality)
        driver_id = request.query_params.get("driver_id")
        vehicle_id = request.query_params.get("vehicle_id")
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if start_date:
            qs = qs.filter(filled_at__gte=start_date)
        if end_date:
            qs = qs.filter(filled_at__lte=end_date)

        total_liters = qs.aggregate(total=Sum("liters"))["total"] or 0
        total_cost = qs.aggregate(total=Sum("total_cost"))["total"] or 0
        summary = {
            "total_logs": qs.count(),
            "total_liters": _format_decimal(total_liters),
            "total_cost": _format_decimal(total_cost),
        }
        if total_liters:
            summary["avg_price_per_liter"] = _format_decimal(Decimal(total_cost) / Decimal(total_liters))
        else:
            summary["avg_price_per_liter"] = None
        summary["budget"] = _fuel_budget_status(user.municipality if user.role != "SUPERADMIN" else None, qs_budget)
        logs_data = []
        for log in qs.select_related("vehicle", "driver").order_by("-filled_at", "-id"):
            receipt_url = request.build_absolute_uri(log.receipt_image.url) if log.receipt_image else None
            logs_data.append(
                {
                    "id": log.id,
                    "filled_at": log.filled_at,
                    "liters": log.liters,
                    "price_per_liter": log.price_per_liter,
                    "total_cost": log.total_cost,
                    "fuel_station": log.fuel_station,
                    "notes": log.notes,
                    "receipt_image": receipt_url,
                    "vehicle__license_plate": log.vehicle.license_plate,
                    "driver__name": log.driver.name,
                }
            )
        return response.Response({"summary": summary, "logs": logs_data})


class FuelCostReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        start = _parse_date(request.query_params.get("start_date"))
        end = _parse_date(request.query_params.get("end_date"))
        qs = FuelLog.objects.select_related("vehicle")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        if start:
            qs = qs.filter(filled_at__gte=start)
        if end:
            qs = qs.filter(filled_at__lte=end)

        fleet_monthly = (
            qs.annotate(period=TruncMonth("filled_at"))
            .values("period")
            .annotate(total_cost=Sum("total_cost"), total_liters=Sum("liters"))
            .order_by("period")
        )
        fleet_annual = (
            qs.annotate(period=TruncYear("filled_at"))
            .values("period")
            .annotate(total_cost=Sum("total_cost"), total_liters=Sum("liters"))
            .order_by("period")
        )
        vehicle_monthly = (
            qs.annotate(period=TruncMonth("filled_at"))
            .values("vehicle_id", "vehicle__license_plate", "period")
            .annotate(total_cost=Sum("total_cost"), total_liters=Sum("liters"))
            .order_by("vehicle__license_plate", "period")
        )
        vehicle_annual = (
            qs.annotate(period=TruncYear("filled_at"))
            .values("vehicle_id", "vehicle__license_plate", "period")
            .annotate(total_cost=Sum("total_cost"), total_liters=Sum("liters"))
            .order_by("vehicle__license_plate", "period")
        )

        summary = {
            "total_cost": qs.aggregate(total=Sum("total_cost"))["total"] or 0,
            "total_liters": qs.aggregate(total=Sum("liters"))["total"] or 0,
        }
        summary["avg_price_per_liter"] = (
            Decimal(summary["total_cost"]) / Decimal(summary["total_liters"])
            if summary["total_liters"]
            else None
        )

        def _normalize(rows):
            normalized = []
            for row in rows:
                period = row.get("period")
                normalized.append(
                    {
                        **row,
                        "period": (period.date() if isinstance(period, datetime) else period).isoformat()
                        if period
                        else None,
                    }
                )
            return normalized

        return response.Response(
            {
                "summary": summary,
                "fleet_monthly": _normalize(fleet_monthly),
                "fleet_annual": _normalize(fleet_annual),
                "vehicle_monthly": _normalize(vehicle_monthly),
                "vehicle_annual": _normalize(vehicle_annual),
            }
        )


class TcoReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        start = _parse_date(request.query_params.get("start_date"))
        end = _parse_date(request.query_params.get("end_date"))

        qs_fuel = FuelLog.objects.select_related("vehicle")
        qs_orders = ServiceOrder.objects.select_related("vehicle")
        qs_rental = RentalPeriod.objects.select_related("vehicle")
        qs_odometer = MonthlyOdometer.objects.select_related("vehicle")

        if user.role != "SUPERADMIN":
            municipality_filter = {"municipality": user.municipality}
            qs_fuel = qs_fuel.filter(**municipality_filter)
            qs_orders = qs_orders.filter(**municipality_filter)
            qs_rental = qs_rental.filter(**municipality_filter)
            qs_odometer = qs_odometer.filter(vehicle__municipality=user.municipality)

        if start:
            qs_fuel = qs_fuel.filter(filled_at__gte=start)
            qs_orders = qs_orders.filter(completed_at__date__gte=start)
            qs_rental = qs_rental.filter(start_datetime__date__gte=start)
        if end:
            qs_fuel = qs_fuel.filter(filled_at__lte=end)
            qs_orders = qs_orders.filter(completed_at__date__lte=end)
            qs_rental = qs_rental.filter(start_datetime__date__lte=end)
        qs_orders = qs_orders.filter(status=ServiceOrder.Status.COMPLETED, completed_at__isnull=False)

        qs_odometer = _filter_odometer_range(qs_odometer, start, end)

        fuel_totals = qs_fuel.values("vehicle_id", "vehicle__license_plate").annotate(total=Sum("total_cost"))
        maintenance_totals = qs_orders.values("vehicle_id", "vehicle__license_plate").annotate(total=Sum("total_cost"))
        contract_totals = qs_rental.values("vehicle_id", "vehicle__license_plate").annotate(total=Sum("billed_amount"))
        km_totals = qs_odometer.values("vehicle_id", "vehicle__license_plate").annotate(total_km=Sum("kilometers"))

        vehicles_map = {}

        def _merge(rows, key, label_key="vehicle__license_plate"):
            for row in rows:
                vehicle_id = row["vehicle_id"]
                entry = vehicles_map.setdefault(
                    vehicle_id,
                    {
                        "vehicle_id": vehicle_id,
                        "vehicle__license_plate": row.get(label_key) or "",
                        "fuel_cost": 0,
                        "maintenance_cost": 0,
                        "contract_cost": 0,
                        "total_km": 0,
                    },
                )
                if row.get(label_key):
                    entry["vehicle__license_plate"] = row[label_key]
                entry[key] = row.get("total") or row.get("total_km") or 0

        _merge(fuel_totals, "fuel_cost")
        _merge(maintenance_totals, "maintenance_cost")
        _merge(contract_totals, "contract_cost")
        _merge(km_totals, "total_km")

        vehicles = []
        total_cost = Decimal("0")
        total_km = Decimal("0")
        for entry in vehicles_map.values():
            fuel_cost = Decimal(entry.get("fuel_cost") or 0)
            maintenance_cost = Decimal(entry.get("maintenance_cost") or 0)
            contract_cost = Decimal(entry.get("contract_cost") or 0)
            total_vehicle_cost = fuel_cost + maintenance_cost + contract_cost
            km = Decimal(entry.get("total_km") or 0)
            total_cost += total_vehicle_cost
            total_km += km
            vehicles.append(
                {
                    "vehicle_id": entry["vehicle_id"],
                    "vehicle__license_plate": entry["vehicle__license_plate"],
                    "fuel_cost": float(fuel_cost),
                    "maintenance_cost": float(maintenance_cost),
                    "contract_cost": float(contract_cost),
                    "total_cost": float(total_vehicle_cost),
                    "total_km": float(km),
                    "cost_per_km": float(total_vehicle_cost / km) if km else None,
                }
            )

        vehicles.sort(key=lambda item: (item["cost_per_km"] is None, item["cost_per_km"] or 0), reverse=True)

        summary = {
            "total_cost": float(total_cost),
            "total_km": float(total_km),
            "cost_per_km": float(total_cost / total_km) if total_km else None,
        }
        return response.Response({"summary": summary, "vehicles": vehicles})

class TripIncidentReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        qs = TripIncident.objects.select_related("trip", "driver", "municipality")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        incidents = qs.values(
            "id",
            "trip_id",
            "trip__origin",
            "trip__destination",
            "trip__departure_datetime",
            "driver__name",
            "description",
            "created_at",
        ).order_by("-created_at")
        return response.Response({"incidents": list(incidents)})


class ContractsReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("expiring_in", OpenApiTypes.INT, description="Days to expire (default 30)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        days = int(request.query_params.get("expiring_in", 30))
        qs = Contract.objects.all()
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        expiring_limit = timezone.localdate() + timedelta(days=days)
        data = []
        for contract in qs:
            data.append(
                {
                    "id": contract.id,
                    "contract_number": contract.contract_number,
                    "provider_name": contract.provider_name,
                    "status": contract.status if not contract.is_expired else Contract.Status.EXPIRED,
                    "start_date": contract.start_date,
                    "end_date": contract.end_date,
                    "type": contract.type,
                    "billing_model": contract.billing_model,
                    "expiring_soon": contract.end_date <= expiring_limit,
                }
            )
        return response.Response({"contracts": data})


class ContractUsageReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("contract_id", OpenApiTypes.INT, description="Contract ID"),
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        contract_id = request.query_params.get("contract_id")
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        qs = RentalPeriod.objects.select_related("contract", "vehicle")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        if contract_id:
            qs = qs.filter(contract_id=contract_id)
        if start:
            qs = qs.filter(start_datetime__date__gte=start)
        if end:
            qs = qs.filter(start_datetime__date__lte=end)

        total_km = qs.aggregate(total=Sum("billed_km"))["total"] or 0
        total_amount = qs.aggregate(total=Sum("billed_amount"))["total"] or 0
        vehicles = (
            qs.exclude(vehicle__isnull=True)
            .values("vehicle_id", "vehicle__license_plate")
            .distinct()
        )
        return response.Response(
            {
                "total_km": total_km,
                "total_amount": total_amount,
                "cost_per_km": (float(total_amount) / float(total_km)) if total_km else None,
                "vehicles": list(vehicles),
                "periods": list(
                    qs.values(
                        "id",
                        "status",
                        "start_datetime",
                        "end_datetime",
                        "vehicle_id",
                        "vehicle__license_plate",
                        "billed_km",
                        "billed_amount",
                    ).order_by("-start_datetime")
                ),
            }
        )


class ExpiringContractsReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("expiring_in", OpenApiTypes.INT, description="Days to expire (default 30)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        user = request.user
        days = int(request.query_params.get("days", 30))
        limit = timezone.localdate() + timedelta(days=days)
        qs = Contract.objects.filter(end_date__lte=limit)
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        return response.Response(
            list(
                qs.values(
                    "id",
                    "contract_number",
                    "provider_name",
                    "end_date",
                    "status",
                    "municipality_id",
                ).order_by("end_date")
            )
        )


class MaintenanceSummaryReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = ServiceOrder.objects.select_related("vehicle", "municipality")
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        if start:
            qs = qs.filter(opened_at__date__gte=start)
        if end:
            qs = qs.filter(opened_at__date__lte=end)

        status_counts = list(qs.values("status").annotate(total=Count("id")))
        total_cost = qs.aggregate(total=Sum("total_cost"))["total"] or 0
        cost_by_vehicle = list(
            qs.values("vehicle_id", "vehicle__license_plate").annotate(total=Sum("total_cost")).order_by(
                "-total"
            )
        )
        return response.Response(
            {
                "status_counts": status_counts,
                "total_cost": total_cost,
                "cost_by_vehicle": cost_by_vehicle,
            }
        )


class MaintenancePreventiveReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        plans = MaintenancePlan.objects.select_related("vehicle")
        if user.role != "SUPERADMIN":
            plans = plans.filter(municipality=user.municipality)
        today = timezone.localdate()
        data = []
        for plan in plans.filter(is_active=True):
            due_km = None
            due_days = None
            if plan.trigger_type == MaintenancePlan.TriggerType.KM and plan.interval_km:
                last = plan.last_service_odometer or 0
                due_km = (plan.vehicle.odometer_current if plan.vehicle else 0) - last
            if plan.trigger_type == MaintenancePlan.TriggerType.TIME and plan.interval_days and plan.last_service_date:
                due_days = (today - plan.last_service_date).days
            data.append(
                {
                    "id": plan.id,
                    "name": plan.name,
                    "vehicle_id": getattr(plan.vehicle, "id", None),
                    "vehicle_plate": getattr(plan.vehicle, "license_plate", None),
                    "trigger_type": plan.trigger_type,
                    "interval_km": plan.interval_km,
                    "interval_days": plan.interval_days,
                    "last_service_odometer": plan.last_service_odometer,
                    "last_service_date": plan.last_service_date,
                    "km_since_last": due_km,
                    "days_since_last": due_days,
                }
            )
        return response.Response({"plans": data})


class InventoryReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        parts = InventoryPart.objects.all()
        movements = InventoryMovement.objects.all()
        if user.role != "SUPERADMIN":
            parts = parts.filter(municipality=user.municipality)
            movements = movements.filter(municipality=user.municipality)
        low_stock = parts.filter(current_stock__lte=F("minimum_stock"))
        start = request.query_params.get("start_date")
        end = request.query_params.get("end_date")
        if start:
            movements = movements.filter(performed_at__date__gte=start)
        if end:
            movements = movements.filter(performed_at__date__lte=end)
        consumption = (
            movements.filter(type__in=[InventoryMovement.MovementType.OUT, InventoryMovement.MovementType.LOAN])
            .values("part_id", "part__name", "part__sku", "part__unit")
            .annotate(total=Sum("quantity"))
        )
        return response.Response(
            {
                "low_stock": list(
                    low_stock.values(
                        "id", "name", "sku", "current_stock", "minimum_stock", "unit", "municipality_id"
                    )
                ),
                "consumption": list(consumption),
            }
        )


class TransportPlanningReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        date_param = request.query_params.get("date")
        try:
            target_date = datetime.strptime(date_param, "%Y-%m-%d").date() if date_param else timezone.localdate()
        except ValueError:
            target_date = timezone.localdate()

        services = TransportService.objects.all()
        routes = Route.objects.select_related("transport_service")
        assignments = Assignment.objects.select_related("route", "vehicle")
        applications = ServiceApplication.objects.all()
        if user.role != "SUPERADMIN":
            services = services.filter(municipality=user.municipality)
            routes = routes.filter(municipality=user.municipality)
            assignments = assignments.filter(municipality=user.municipality)
            applications = applications.filter(municipality=user.municipality)

        assignments_for_day = assignments.filter(date=target_date)
        routes_with_assignment = set(assignments_for_day.values_list("route_id", flat=True))
        routes_without_assignment = routes.filter(active=True).exclude(id__in=routes_with_assignment)

        services_summary = []
        for service in services:
            service_routes = routes.filter(transport_service=service)
            service_assignments = assignments_for_day.filter(route__transport_service=service)
            service_apps = applications.filter(transport_service=service)
            services_summary.append(
                {
                    "id": service.id,
                    "name": service.name,
                    "routes": service_routes.count(),
                    "assignments_day": service_assignments.count(),
                    "applications": service_apps.count(),
                    "applications_by_status": list(
                        service_apps.values("status").annotate(total=Count("id"))
                    ),
                }
            )

        capacity = []
        for item in assignments_for_day:
            capacity.append(
                {
                    "assignment_id": item.id,
                    "route": item.route.name,
                    "vehicle": item.vehicle.license_plate,
                    "planned_capacity": item.route.planned_capacity,
                    "vehicle_capacity": item.vehicle.max_passengers,
                }
            )

        summary = {
            "date": target_date,
            "active_routes": routes.filter(active=True).count(),
            "inactive_routes": routes.filter(active=False).count(),
            "routes_without_assignment": routes_without_assignment.count(),
            "assignments_conflicts": assignments_for_day.filter(status=Assignment.Status.DRAFT).count(),
        }

        return response.Response(
            {
                "summary": summary,
                "services": services_summary,
                "capacity": capacity,
            }
        )


class DriverAvailabilityReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        start_param = request.query_params.get("start_date")
        end_param = request.query_params.get("end_date")
        try:
            start_date = datetime.strptime(start_param, "%Y-%m-%d").date() if start_param else timezone.localdate()
            end_date = datetime.strptime(end_param, "%Y-%m-%d").date() if end_param else start_date + timedelta(days=30)
        except ValueError:
            return response.Response({"detail": "Datas inválidas. Use formato YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        if end_date < start_date:
            return response.Response({"detail": "Data final deve ser posterior à inicial."}, status=status.HTTP_400_BAD_REQUEST)

        start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()), timezone.get_default_timezone())
        end_dt = timezone.make_aware(datetime.combine(end_date, datetime.max.time()), timezone.get_default_timezone())

        trips_qs = Trip.objects.filter(
            departure_datetime__lt=end_dt, return_datetime_expected__gt=start_dt
        ).select_related("driver", "municipality")
        blocks_qs = DriverAvailabilityBlock.objects.filter(
            start_datetime__lt=end_dt, end_datetime__gt=start_dt, status=DriverAvailabilityBlock.Status.ACTIVE
        ).select_related("driver", "municipality")

        if user.role != "SUPERADMIN":
            trips_qs = trips_qs.filter(municipality=user.municipality)
            blocks_qs = blocks_qs.filter(municipality=user.municipality)

        duration_expr = ExpressionWrapper(
            F("return_datetime_expected") - F("departure_datetime"), output_field=DurationField()
        )
        allocation = trips_qs.values("driver_id", "driver__name").annotate(
            total_duration=Sum(duration_expr), trips=Count("id")
        )
        allocation_payload = []
        for item in allocation:
            total_seconds = item["total_duration"].total_seconds() if item["total_duration"] else 0
            allocation_payload.append(
                {
                    "driver_id": item["driver_id"],
                    "driver_name": item["driver__name"],
                    "hours": round(total_seconds / 3600, 2),
                    "trips": item["trips"],
                }
            )
        allocation_payload.sort(key=lambda i: i["hours"], reverse=True)

        blocked = list(
            blocks_qs.values(
                "id",
                "driver_id",
                "driver__name",
                "type",
                "start_datetime",
                "end_datetime",
                "municipality_id",
            ).order_by("start_datetime")
        )

        pending_trips = trips_qs.filter(driver__isnull=True, status=Trip.Status.PLANNED).count()

        return response.Response(
            {
                "range": {"start": start_date, "end": end_date},
                "blocked_drivers": blocked,
                "allocation_hours": allocation_payload,
                "top_load": allocation_payload[:5],
                "pending_trips_without_driver": pending_trips,
            }
        )


class TireReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tires = Tire.objects.all()
        if user.role != "SUPERADMIN":
            tires = tires.filter(municipality=user.municipality)
        status_counts = list(tires.values("status").annotate(total=Count("id")))
        nearing_end = []
        for tire in tires:
            if tire.max_km_life and tire.total_km >= tire.max_km_life * 0.9:
                nearing_end.append(
                    {
                        "id": tire.id,
                        "code": tire.code,
                        "brand": tire.brand,
                        "model": tire.model,
                        "total_km": tire.total_km,
                        "max_km_life": tire.max_km_life,
                        "status": tire.status,
                    }
                )
        cost_per_km = []
        for tire in tires:
            if tire.total_km:
                cost_per_km.append({"id": tire.id, "code": tire.code, "value": float(tire.purchase_price) / tire.total_km})
        return response.Response(
            {
                "status_counts": status_counts,
                "nearing_end_of_life": nearing_end,
                "cost_per_km": cost_per_km,
            }
        )


class TripExecutionReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        start_date = _parse_date(request.query_params.get("start_date"))
        end_date = _parse_date(request.query_params.get("end_date"))
        module = request.query_params.get("module")
        destination_id = request.query_params.get("destination_id")
        vehicle_id = request.query_params.get("vehicle_id")
        driver_id = request.query_params.get("driver_id")

        qs = TripExecution.objects.select_related("vehicle", "driver")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        if start_date:
            qs = qs.filter(scheduled_departure__date__gte=start_date)
        if end_date:
            qs = qs.filter(scheduled_departure__date__lte=end_date)
        if module:
            qs = qs.filter(module=module)
        if destination_id:
            qs = qs.filter(stops__destination_id=destination_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)

        qs = qs.distinct()
        total_trips = qs.count()
        total_passengers = (
            TripManifest.objects.filter(trip_execution__in=qs).aggregate(total=Sum("total_passengers"))["total"] or 0
        )

        vehicle_stats_raw = (
            qs.values("vehicle_id", "vehicle__license_plate", "vehicle__max_passengers")
            .annotate(trips=Count("id"), passengers=Sum("manifest__total_passengers"))
            .order_by("vehicle__license_plate")
        )
        vehicle_stats = []
        for item in vehicle_stats_raw:
            capacity = item["vehicle__max_passengers"] or 0
            trips = item["trips"] or 0
            passengers = item["passengers"] or 0
            occupancy = (passengers / (capacity * trips)) if capacity and trips else 0
            vehicle_stats.append(
                {
                    "vehicle_id": item["vehicle_id"],
                    "license_plate": item["vehicle__license_plate"],
                    "trips": trips,
                    "passengers": passengers,
                    "occupancy_rate": round(occupancy, 3),
                }
            )

        trips_payload = list(
            qs.values(
                "id",
                "module",
                "status",
                "scheduled_departure",
                "scheduled_return",
                "vehicle_id",
                "vehicle__license_plate",
                "driver_id",
                "driver__name",
            )
            .order_by("-scheduled_departure")[:500]
        )

        return response.Response(
            {
                "summary": {
                    "total_trips": total_trips,
                    "total_passengers": total_passengers,
                },
                "vehicles": vehicle_stats,
                "trips": trips_payload,
            }
        )


class SchoolTransportReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        start_date = _parse_date(request.query_params.get("start_date"))
        end_date = _parse_date(request.query_params.get("end_date"))
        school_id = request.query_params.get("school_id")
        vehicle_id = request.query_params.get("vehicle_id")
        driver_id = request.query_params.get("driver_id")

        qs = TripExecution.objects.select_related("vehicle", "driver").filter(module=PlannedTrip.Module.EDUCATION)
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
        if start_date:
            qs = qs.filter(scheduled_departure__date__gte=start_date)
        if end_date:
            qs = qs.filter(scheduled_departure__date__lte=end_date)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if school_id:
            qs = qs.filter(
                manifest__passengers__passenger_type=TripManifestPassenger.PassengerType.STUDENT,
                manifest__passengers__student__school_id=school_id,
            )

        qs = qs.distinct()
        total_trips = qs.count()
        students_qs = TripManifestPassenger.objects.filter(
            manifest__trip_execution__in=qs,
            passenger_type=TripManifestPassenger.PassengerType.STUDENT,
        )
        total_students = students_qs.count()
        special_needs = students_qs.filter(student__has_special_needs=True).count()

        routes_per_day = list(
            qs.values("scheduled_departure__date")
            .annotate(total=Count("id"))
            .order_by("scheduled_departure__date")
        )

        students_by_school = list(
            students_qs.values("student__school_id", "student__school__name")
            .annotate(total=Count("id"))
            .order_by("student__school__name")
        )

        return response.Response(
            {
                "summary": {
                    "total_trips": total_trips,
                    "total_students": total_students,
                    "special_needs_students": special_needs,
                },
                "routes_per_day": routes_per_day,
                "students_by_school": students_by_school,
            }
        )
