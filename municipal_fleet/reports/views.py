from datetime import date
from django.db.models import Count, Sum, F, ExpressionWrapper, IntegerField
from django.utils import timezone
from rest_framework import permissions, response, views
from fleet.models import Vehicle
from trips.models import Trip, MonthlyOdometer


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
                "vehicle__license_plate",
                "driver__name",
            )
        )
        return response.Response({"summary": summary, "trips": trips_data})
