from datetime import date, timedelta
from django.db.models import Count, Sum, F, ExpressionWrapper, IntegerField
from django.utils import timezone
from rest_framework import permissions, response, views
from fleet.models import Vehicle, FuelLog
from trips.models import Trip, TripIncident, MonthlyOdometer
from contracts.models import Contract, RentalPeriod
from maintenance.models import ServiceOrder, MaintenancePlan, InventoryPart, InventoryMovement, Tire


class DashboardView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs_vehicle = Vehicle.objects.all()
        qs_trip = Trip.objects.all()
        if user.role != "SUPERADMIN":
            qs_vehicle = qs_vehicle.filter(municipality=user.municipality)
            qs_trip = qs_trip.filter(municipality=user.municipality)

        vehicle_status = qs_vehicle.values("status").annotate(total=Count("id"))
        now = timezone.now()
        trips_month = qs_trip.filter(departure_datetime__month=now.month, departure_datetime__year=now.year)
        trips_by_status = trips_month.values("status").annotate(total=Count("id"))

        maintenance_alerts = qs_vehicle.filter(
            next_service_date__lte=date.today()
        ).values("id", "license_plate", "next_service_date")

        odometer_month = MonthlyOdometer.objects.filter(year=now.year, month=now.month)
        if user.role != "SUPERADMIN":
            odometer_month = odometer_month.filter(vehicle__municipality=user.municipality)

        data = {
            "total_vehicles": qs_vehicle.count(),
            "vehicles_by_status": list(vehicle_status),
            "trips_month_total": trips_month.count(),
            "trips_by_status": list(trips_by_status),
            "odometer_month": list(
                odometer_month.values("vehicle_id", "vehicle__license_plate", "kilometers")
            ),
            "maintenance_alerts": list(maintenance_alerts),
        }
        return response.Response(data)


class OdometerReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

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

    def get(self, request):
        user = request.user
        qs = FuelLog.objects.select_related("vehicle", "driver")
        if user.role != "SUPERADMIN":
            qs = qs.filter(municipality=user.municipality)
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

        summary = {
            "total_logs": qs.count(),
            "total_liters": qs.aggregate(total=Sum("liters"))["total"] or 0,
        }
        logs_data = []
        for log in qs.select_related("vehicle", "driver").order_by("-filled_at", "-id"):
            receipt_url = request.build_absolute_uri(log.receipt_image.url) if log.receipt_image else None
            logs_data.append(
                {
                    "id": log.id,
                    "filled_at": log.filled_at,
                    "liters": log.liters,
                    "fuel_station": log.fuel_station,
                    "notes": log.notes,
                    "receipt_image": receipt_url,
                    "vehicle__license_plate": log.vehicle.license_plate,
                    "driver__name": log.driver.name,
                }
            )
        return response.Response({"summary": summary, "logs": logs_data})


class TripIncidentReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

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
            movements.filter(type=InventoryMovement.MovementType.OUT)
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
