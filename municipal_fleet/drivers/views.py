from datetime import timedelta
from rest_framework import viewsets, permissions, filters, views, response, exceptions, parsers, status
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from drivers.models import Driver
from drivers.serializers import DriverSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly
from drivers.portal import generate_portal_token, resolve_portal_token
from fleet.models import FuelLog, FuelStation, Vehicle
from fleet.serializers import FuelLogSerializer
from trips.models import Trip, TripIncident, FreeTrip
from trips.serializers import TripSerializer, TripIncidentSerializer, FreeTripSerializer
from transport_planning.models import Assignment


class DriverViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("municipality")
    serializer_class = DriverSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "cpf", "phone"]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "SUPERADMIN":
            serializer.save(municipality=user.municipality)
        else:
            municipality = serializer.validated_data.get("municipality")
            if not municipality:
                raise ValidationError("Prefeitura é obrigatória para criação por SUPERADMIN.")
            serializer.save(municipality=municipality)


class DriverPortalAuthMixin:
    def get_portal_driver(self, request):
        token = request.headers.get("X-Driver-Token") or request.query_params.get("driver_token")
        if not token:
            raise exceptions.PermissionDenied("Token do motorista não informado.")
        try:
            driver = resolve_portal_token(token)
        except Exception:
            raise exceptions.PermissionDenied("Token inválido ou expirado.")
        request.driver_portal = driver
        return driver


class DriverPortalLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code_raw = request.data.get("code", "")
        code = str(code_raw).strip().upper()
        if not code:
            return response.Response({"detail": "Código do motorista é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
        driver = Driver.objects.filter(access_code=code, status=Driver.Status.ACTIVE).select_related("municipality").first()
        if not driver:
            return response.Response({"detail": "Código inválido ou motorista inativo."}, status=status.HTTP_400_BAD_REQUEST)
        token = generate_portal_token(driver)
        payload = {
            "id": driver.id,
            "name": driver.name,
            "municipality": driver.municipality_id,
            "access_code": driver.access_code,
            "phone": driver.phone,
            "free_trip_enabled": driver.free_trip_enabled,
        }
        return response.Response({"token": token, "driver": payload})


class DriverPortalTripsView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = self.get_portal_driver(request)
        trips = (
            driver.trips.select_related("vehicle")
            .order_by("-departure_datetime")
            .values(
                "id",
                "origin",
                "destination",
                "status",
                "category",
                "departure_datetime",
                "return_datetime_expected",
                "return_datetime_actual",
                "passengers_count",
                "passengers_details",
                "cargo_description",
                "cargo_size",
                "cargo_quantity",
                "cargo_purpose",
                "vehicle_id",
                "vehicle__license_plate",
            )
        )
        return response.Response({"driver": driver.name, "trips": list(trips)})


class DriverPortalAssignmentsView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = self.get_portal_driver(request)
        today = timezone.localdate()
        try:
            days = int(request.query_params.get("days", 60))
        except (TypeError, ValueError):
            days = 60
        days = max(1, min(days, 180))
        end_date = today + timedelta(days=days)
        assignments = (
            Assignment.objects.filter(driver=driver, date__gte=today, date__lte=end_date)
            .select_related("route__transport_service", "vehicle")
            .order_by("date", "route__time_window_start", "id")
        )
        payload = []
        for assignment in assignments:
            start, end = assignment.estimated_period()
            route = assignment.route
            payload.append(
                {
                    "id": assignment.id,
                    "status": assignment.status,
                    "date": assignment.date,
                    "notes": assignment.notes,
                    "generated_trip_id": assignment.generated_trip_id,
                    "route": {
                        "id": route.id,
                        "code": route.code,
                        "name": route.name,
                        "route_type": route.route_type,
                        "service_name": route.transport_service.name if route.transport_service else None,
                        "time_window_start": route.time_window_start,
                        "time_window_end": route.time_window_end,
                        "planned_capacity": route.planned_capacity,
                    },
                    "vehicle": {
                        "id": assignment.vehicle_id,
                        "license_plate": assignment.vehicle.license_plate,
                    },
                    "period_start": start,
                    "period_end": end,
                }
            )
        return response.Response({"assignments": payload})


class DriverPortalTripCompleteView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, trip_id: int):
        driver = self.get_portal_driver(request)
        trip = driver.trips.filter(id=trip_id).first()
        if not trip:
            return response.Response({"detail": "Viagem não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        serializer = TripSerializer(
            trip,
            data={"status": Trip.Status.COMPLETED, "return_datetime_actual": timezone.now()},
            partial=True,
            context={"request": request, "portal_driver": driver},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)


class DriverPortalTripIncidentView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, trip_id: int):
        driver = self.get_portal_driver(request)
        trip = driver.trips.filter(id=trip_id).first()
        if not trip:
            return response.Response({"detail": "Viagem não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        description = str(request.data.get("description", "")).strip()
        if not description:
            return response.Response({"detail": "Descrição é obrigatória."}, status=status.HTTP_400_BAD_REQUEST)
        incident = TripIncident.objects.create(
            municipality=driver.municipality, trip=trip, driver=driver, description=description
        )
        serializer = TripIncidentSerializer(incident)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class DriverPortalFuelLogView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get(self, request):
        driver = self.get_portal_driver(request)
        logs_qs = (
            FuelLog.objects.filter(driver=driver)
            .select_related("vehicle")
            .order_by("-filled_at", "-created_at")
        )
        logs = []
        for log in logs_qs:
            logs.append(
                {
                    "id": log.id,
                    "filled_at": log.filled_at,
                    "liters": log.liters,
                    "fuel_station": log.fuel_station,
                    "fuel_station_ref_id": log.fuel_station_ref_id,
                    "notes": log.notes,
                    "receipt_image": request.build_absolute_uri(log.receipt_image.url)
                    if log.receipt_image
                    else None,
                    "vehicle_id": log.vehicle_id,
                    "vehicle__license_plate": log.vehicle.license_plate,
                }
            )
        return response.Response({"logs": logs})

    def post(self, request):
        driver = self.get_portal_driver(request)
        serializer = FuelLogSerializer(
            data=request.data,
            context={"request": request, "portal_driver": driver},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(driver=driver, municipality=driver.municipality)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class DriverPortalFuelStationsView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = self.get_portal_driver(request)
        stations = (
            FuelStation.objects.filter(municipality=driver.municipality, active=True)
            .order_by("name")
            .values("id", "name", "address")
        )
        return response.Response({"stations": list(stations)})


class DriverPortalFreeTripListView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = self.get_portal_driver(request)
        open_trip = driver.free_trips.filter(status=FreeTrip.Status.OPEN).select_related("vehicle").first()
        recent_closed = driver.free_trips.filter(status=FreeTrip.Status.CLOSED).order_by("-ended_at")[:5]
        data = {
            "open_trip": FreeTripSerializer(
                open_trip, context={"portal_driver": driver, "request": request}
            ).data
            if open_trip
            else None,
            "recent_closed": FreeTripSerializer(
                recent_closed, many=True, context={"portal_driver": driver, "request": request}
            ).data,
        }
        return response.Response(data)


class DriverPortalFreeTripStartView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def post(self, request):
        driver = self.get_portal_driver(request)
        if not driver.free_trip_enabled:
            return response.Response({"detail": "Viagem livre não liberada para este motorista."}, status=status.HTTP_403_FORBIDDEN)
        if driver.free_trips.filter(status=FreeTrip.Status.OPEN).exists():
            return response.Response({"detail": "Já existe uma viagem livre em andamento."}, status=status.HTTP_400_BAD_REQUEST)

        vehicle_id = request.data.get("vehicle_id")
        license_plate = request.data.get("license_plate")
        vehicle_qs = Vehicle.objects.filter(municipality=driver.municipality)
        vehicle = None
        if vehicle_id:
            vehicle = vehicle_qs.filter(id=vehicle_id).first()
        if not vehicle and license_plate:
            vehicle = vehicle_qs.filter(license_plate__iexact=str(license_plate).strip()).first()
        if not vehicle:
            return response.Response({"detail": "Veículo não encontrado na prefeitura do motorista."}, status=status.HTTP_404_NOT_FOUND)

        try:
            odometer_start = int(request.data.get("odometer_start", 0))
        except (TypeError, ValueError):
            return response.Response({"detail": "Quilometragem inicial inválida."}, status=status.HTTP_400_BAD_REQUEST)
        if odometer_start < 0:
            return response.Response({"detail": "Quilometragem inicial inválida."}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "driver": driver.id,
            "vehicle": vehicle.id,
            "odometer_start": odometer_start,
            "odometer_start_photo": request.data.get("odometer_start_photo"),
        }
        serializer = FreeTripSerializer(data=payload, context={"request": request, "portal_driver": driver})
        serializer.is_valid(raise_exception=True)
        free_trip = serializer.save()
        return response.Response(serializer.to_representation(free_trip), status=status.HTTP_201_CREATED)


class DriverPortalFreeTripCloseView(DriverPortalAuthMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def post(self, request, free_trip_id: int):
        driver = self.get_portal_driver(request)
        free_trip = driver.free_trips.filter(id=free_trip_id, status=FreeTrip.Status.OPEN).first()
        if not free_trip:
            return response.Response({"detail": "Viagem livre não encontrada ou já encerrada."}, status=status.HTTP_404_NOT_FOUND)
        try:
            odometer_end = int(request.data.get("odometer_end", 0))
        except (TypeError, ValueError):
            return response.Response({"detail": "Quilometragem final inválida."}, status=status.HTTP_400_BAD_REQUEST)

        data = {
            "odometer_end": odometer_end,
            "odometer_end_photo": request.data.get("odometer_end_photo"),
            "status": FreeTrip.Status.CLOSED,
        }
        serializer = FreeTripSerializer(
            free_trip, data=data, partial=True, context={"request": request, "portal_driver": driver}
        )
        serializer.is_valid(raise_exception=True)
        free_trip = serializer.save()
        return response.Response(serializer.data)
