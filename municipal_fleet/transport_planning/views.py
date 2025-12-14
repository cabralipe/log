from datetime import datetime, timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import viewsets, permissions, filters, decorators, response, status
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly, IsMunicipalityAdmin
from transport_planning.models import (
    Person,
    TransportService,
    Route,
    RouteStop,
    ServiceUnit,
    EligibilityPolicy,
    ServiceApplication,
    Assignment,
)
from transport_planning.serializers import (
    PersonSerializer,
    TransportServiceSerializer,
    RouteSerializer,
    RouteStopSerializer,
    ServiceUnitSerializer,
    EligibilityPolicySerializer,
    ServiceApplicationSerializer,
    AssignmentSerializer,
)
from fleet.models import Vehicle
from drivers.models import Driver
from trips.models import Trip


class PersonViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["full_name", "cpf"]


class TransportServiceViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = TransportService.objects.select_related("municipality", "form_template")
    serializer_class = TransportServiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "description"]


class ServiceUnitViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = ServiceUnit.objects.select_related("municipality")
    serializer_class = ServiceUnitSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "address"]


class RouteViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Route.objects.select_related("transport_service", "municipality", "contract").prefetch_related(
        "preferred_vehicles", "preferred_drivers", "stops"
    )
    serializer_class = RouteSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "code"]

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get("transport_service")
        active = self.request.query_params.get("active")
        if service_id:
            qs = qs.filter(transport_service_id=service_id)
        if active is not None:
            qs = qs.filter(active=active.lower() == "true")
        return qs

    @decorators.action(detail=True, methods=["get", "post"], url_path="stops")
    def stops(self, request, pk=None):
        route = self.get_object()
        if request.method == "GET":
            serializer = RouteStopSerializer(route.stops.all(), many=True)
            return response.Response(serializer.data)
        serializer = RouteStopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(route=route, municipality=route.municipality)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class RouteStopViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = RouteStop.objects.select_related("route", "municipality")
    serializer_class = RouteStopSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    municipality_field = "route__municipality"


class EligibilityPolicyViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = EligibilityPolicy.objects.select_related("transport_service", "route", "municipality")
    serializer_class = EligibilityPolicySerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]


class ServiceApplicationViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = ServiceApplication.objects.select_related(
        "person", "transport_service", "route", "form_submission", "municipality"
    )
    serializer_class = ServiceApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["person__full_name", "person__cpf", "transport_service__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        service_id = self.request.query_params.get("transport_service")
        route_id = self.request.query_params.get("route")
        if status_param:
            qs = qs.filter(status=status_param)
        if service_id:
            qs = qs.filter(transport_service_id=service_id)
        if route_id:
            qs = qs.filter(route_id=route_id)
        return qs

    @decorators.action(detail=True, methods=["patch"], url_path="review")
    def review(self, request, pk=None):
        application = self.get_object()
        status_value = request.data.get("status")
        notes = request.data.get("status_notes", "")
        if status_value not in ServiceApplication.Status.values:
            return response.Response({"detail": "Status inválido."}, status=status.HTTP_400_BAD_REQUEST)
        application.status = status_value
        application.status_notes = notes
        application.save(update_fields=["status", "status_notes", "updated_at"])
        return response.Response(self.get_serializer(application).data)


class AssignmentViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("route", "vehicle", "driver", "generated_trip", "municipality")
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["route__name", "route__code", "vehicle__license_plate", "driver__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        date_param = self.request.query_params.get("date")
        route_id = self.request.query_params.get("route")
        status_param = self.request.query_params.get("status")
        if date_param:
            qs = qs.filter(date=date_param)
        if route_id:
            qs = qs.filter(route_id=route_id)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def _parse_date(self, value: str):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return None

    def _available_resources(self, route: Route, date_value):
        start_time = route.time_window_start
        end_time = route.time_window_end
        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.combine(date_value, start_time), timezone=tz) if start_time else None
        end_dt = timezone.make_aware(datetime.combine(date_value, end_time), timezone=tz) if end_time else None
        if start_dt and not end_dt and route.estimated_duration_minutes:
            end_dt = start_dt + timedelta(minutes=route.estimated_duration_minutes)
            end_time = end_dt.time()

        vehicles = Vehicle.objects.filter(municipality=route.municipality, status__in=[Vehicle.Status.AVAILABLE, Vehicle.Status.IN_USE])
        if route.planned_capacity:
            vehicles = vehicles.filter(max_passengers__gte=route.planned_capacity)
        drivers = Driver.objects.filter(municipality=route.municipality, status=Driver.Status.ACTIVE)

        if start_dt and end_dt and start_time and end_time:
            vehicles = vehicles.exclude(
                trips__status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
                trips__departure_datetime__lt=end_dt,
                trips__return_datetime_expected__gt=start_dt,
            ).exclude(
                assignments__date=date_value,
                assignments__status__in=[Assignment.Status.DRAFT, Assignment.Status.CONFIRMED],
                assignments__route__time_window_start__isnull=False,
                assignments__route__time_window_end__isnull=False,
                assignments__route__time_window_start__lt=end_time,
                assignments__route__time_window_end__gt=start_time,
            ).distinct()
            drivers = drivers.exclude(
                trips__status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
                trips__departure_datetime__lt=end_dt,
                trips__return_datetime_expected__gt=start_dt,
            ).exclude(
                assignments__date=date_value,
                assignments__status__in=[Assignment.Status.DRAFT, Assignment.Status.CONFIRMED],
                assignments__route__time_window_start__isnull=False,
                assignments__route__time_window_end__isnull=False,
                assignments__route__time_window_start__lt=end_time,
                assignments__route__time_window_end__gt=start_time,
            ).distinct()

        preferred_vehicle_ids = set(route.preferred_vehicles.values_list("id", flat=True))
        preferred_driver_ids = set(route.preferred_drivers.values_list("id", flat=True))
        vehicles_payload = []
        for vehicle in vehicles:
            vehicles_payload.append(
                {
                    "id": vehicle.id,
                    "license_plate": vehicle.license_plate,
                    "model": vehicle.model,
                    "preferred": vehicle.id in preferred_vehicle_ids,
                    "capacity": vehicle.max_passengers,
                }
            )
        drivers_payload = []
        for driver in drivers:
            drivers_payload.append(
                {
                    "id": driver.id,
                    "name": driver.name,
                    "preferred": driver.id in preferred_driver_ids,
                }
            )
        return vehicles_payload, drivers_payload

    @decorators.action(detail=False, methods=["get"], url_path="suggest")
    def suggest(self, request):
        route_id = request.query_params.get("route_id")
        date_param = request.query_params.get("date")
        date_value = self._parse_date(date_param)
        if not route_id or not date_value:
            return response.Response({"detail": "Informe route_id e date=YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        route = get_object_or_404(Route, id=route_id)
        if request.user.role != "SUPERADMIN" and route.municipality_id != request.user.municipality_id:
            return response.Response({"detail": "Rota não pertence à sua prefeitura."}, status=status.HTTP_403_FORBIDDEN)
        vehicles_payload, drivers_payload = self._available_resources(route, date_value)
        return response.Response({"vehicles": vehicles_payload, "drivers": drivers_payload})

    @decorators.action(detail=False, methods=["post"], url_path="generate-day")
    @transaction.atomic
    def generate_day(self, request):
        date_param = request.query_params.get("date")
        date_value = self._parse_date(date_param)
        if not date_value:
            return response.Response({"detail": "Data inválida, use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        routes = Route.objects.filter(active=True)
        if user.role != "SUPERADMIN":
            routes = routes.filter(municipality=user.municipality)
        weekday = date_value.weekday()
        routes = [
            r
            for r in routes
            if not r.days_of_week or weekday in {int(d) for d in r.days_of_week}
        ]
        created = []
        for route in routes:
            exists = Assignment.objects.filter(route=route, date=date_value).exists()
            if exists:
                continue
            vehicles, drivers = self._available_resources(route, date_value)
            if not vehicles or not drivers:
                continue
            vehicle_id = vehicles[0]["id"]
            driver_id = drivers[0]["id"]
            assignment = Assignment.objects.create(
                municipality=route.municipality,
                route=route,
                date=date_value,
                vehicle_id=vehicle_id,
                driver_id=driver_id,
                status=Assignment.Status.DRAFT,
            )
            created.append(assignment.id)
        return response.Response({"created": created})
