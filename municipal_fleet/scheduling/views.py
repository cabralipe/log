from datetime import datetime, time
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone, dateparse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, views, response, status
from rest_framework.exceptions import ValidationError, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from scheduling.models import DriverAvailabilityBlock
from scheduling.serializers import DriverAvailabilityBlockSerializer
from scheduling.permissions import DriverAvailabilityBlockPermission
from tenants.mixins import MunicipalityQuerysetMixin
from drivers.models import Driver
from trips.models import Trip


class DriverAvailabilityBlockViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = DriverAvailabilityBlock.objects.select_related("driver", "municipality", "created_by")
    serializer_class = DriverAvailabilityBlockSerializer
    permission_classes = [permissions.IsAuthenticated, DriverAvailabilityBlockPermission]
    filterset_fields = ["driver_id", "type", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        driver_id = self.request.query_params.get("driver_id")
        type_param = self.request.query_params.get("type")
        status_param = self.request.query_params.get("status")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if type_param:
            qs = qs.filter(type=type_param)
        if status_param:
            qs = qs.filter(status=status_param)
        if start_date:
            qs = qs.filter(end_datetime__date__gte=start_date)
        if end_date:
            qs = qs.filter(start_datetime__date__lte=end_date)
        return qs

    def perform_destroy(self, instance):
        instance.status = DriverAvailabilityBlock.Status.CANCELLED
        instance.save(update_fields=["status", "updated_at"])


from drf_spectacular.utils import extend_schema

class AvailableDriversView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start", OpenApiTypes.DATETIME, description="Start datetime (ISO 8601)"),
            OpenApiParameter("end", OpenApiTypes.DATETIME, description="End datetime (ISO 8601)"),
            OpenApiParameter("municipality", OpenApiTypes.INT, description="Municipality ID (Superadmin only)"),
        ],
        responses={200: DriverAvailabilityBlockSerializer(many=True)},  # Approximate response
    )
    def get(self, request):
        start_param = request.query_params.get("start")
        end_param = request.query_params.get("end")
        if not start_param or not end_param:
            raise ValidationError("Parâmetros start e end são obrigatórios.")
        start_dt = dateparse.parse_datetime(start_param)
        end_dt = dateparse.parse_datetime(end_param)
        if not start_dt or not end_dt:
            raise ValidationError("Datas inválidas. Use formato YYYY-MM-DDTHH:MM.")
        if timezone.is_naive(start_dt):
            start_dt = timezone.make_aware(start_dt, timezone.get_default_timezone())
        if timezone.is_naive(end_dt):
            end_dt = timezone.make_aware(end_dt, timezone.get_default_timezone())
        if start_dt >= end_dt:
            raise ValidationError("Data inicial deve ser anterior à final.")

        user = request.user
        drivers_qs = Driver.objects.filter(status=Driver.Status.ACTIVE)
        if user.role != "SUPERADMIN":
            drivers_qs = drivers_qs.filter(municipality=user.municipality)
        else:
            municipality_param = request.query_params.get("municipality")
            if municipality_param:
                drivers_qs = drivers_qs.filter(municipality_id=municipality_param)

        trip_conflict = Trip.objects.filter(
            driver_id=OuterRef("pk"),
            status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
            departure_datetime__lt=end_dt,
            return_datetime_expected__gt=start_dt,
        )
        block_conflict = DriverAvailabilityBlock.objects.filter(
            driver_id=OuterRef("pk"),
            status=DriverAvailabilityBlock.Status.ACTIVE,
            start_datetime__lt=end_dt,
            end_datetime__gt=start_dt,
        )
        drivers_qs = drivers_qs.annotate(has_trip=Exists(trip_conflict), has_block=Exists(block_conflict))
        drivers_qs = drivers_qs.filter(has_trip=False, has_block=False)
        data = [
            {
                "id": d.id,
                "name": d.name,
                "municipality": d.municipality_id,
                "status": d.status,
            }
            for d in drivers_qs.order_by("name")
        ]
        return response.Response({"available_drivers": data, "count": len(data)})


class DriverCalendarView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", OpenApiTypes.DATE, description="Start date (YYYY-MM-DD)"),
            OpenApiParameter("end_date", OpenApiTypes.DATE, description="End date (YYYY-MM-DD)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request, driver_id: int):
        driver = get_object_or_404(Driver.objects.select_related("municipality"), pk=driver_id)
        user = request.user
        if user.role != "SUPERADMIN" and driver.municipality_id != getattr(user, "municipality_id", None):
            raise PermissionDenied("Sem permissão para consultar calendário de outra prefeitura.")

        start_date_param = request.query_params.get("start_date")
        end_date_param = request.query_params.get("end_date")
        if not start_date_param or not end_date_param:
            raise ValidationError("Parâmetros start_date e end_date são obrigatórios.")
        start_date = dateparse.parse_date(start_date_param)
        end_date = dateparse.parse_date(end_date_param)
        if not start_date or not end_date:
            raise ValidationError("Datas inválidas. Use formato YYYY-MM-DD.")
        if start_date > end_date:
            raise ValidationError("Data inicial deve ser anterior ou igual à final.")

        tz = timezone.get_default_timezone()
        start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tz)
        end_dt = timezone.make_aware(datetime.combine(end_date, time.max), tz)

        trips_qs = Trip.objects.filter(
            driver=driver,
            status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
            departure_datetime__lt=end_dt,
            return_datetime_expected__gt=start_dt,
        )
        blocks_qs = DriverAvailabilityBlock.objects.filter(
            driver=driver,
            status=DriverAvailabilityBlock.Status.ACTIVE,
            start_datetime__lt=end_dt,
            end_datetime__gt=start_dt,
        )

        events = []
        for trip in trips_qs:
            events.append(
                {
                    "type": "TRIP",
                    "id": trip.id,
                    "start": trip.departure_datetime,
                    "end": trip.return_datetime_expected,
                    "status": trip.status,
                    "title": f"{trip.origin} -> {trip.destination}",
                }
            )
        for block in blocks_qs:
            events.append(
                {
                    "type": "BLOCK",
                    "id": block.id,
                    "start": block.start_datetime,
                    "end": block.end_datetime,
                    "block_type": block.type,
                    "status": block.status,
                    "title": block.get_type_display(),
                }
            )
        events.sort(key=lambda e: e["start"])
        return response.Response(
            {
                "driver_id": driver.id,
                "range": {"start": start_date, "end": end_date},
                "events": events,
            }
        )
