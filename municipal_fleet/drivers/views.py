from rest_framework import viewsets, permissions, filters, views, response, exceptions, parsers, status
from django.utils import timezone
from drivers.models import Driver
from drivers.serializers import DriverSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly
from drivers.portal import generate_portal_token, resolve_portal_token
from fleet.models import FuelLog, FuelStation
from fleet.serializers import FuelLogSerializer
from trips.models import Trip, TripIncident
from trips.serializers import TripSerializer, TripIncidentSerializer


class DriverViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("municipality")
    serializer_class = DriverSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "cpf", "phone"]

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(municipality=user.municipality if user.role != "SUPERADMIN" else serializer.validated_data.get("municipality"))


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
        logs = (
            FuelLog.objects.filter(driver=driver)
            .select_related("vehicle")
            .order_by("-filled_at", "-created_at")
            .values(
                "id",
                "filled_at",
                "liters",
                "fuel_station",
                "fuel_station_ref_id",
                "notes",
                "receipt_image",
                "vehicle_id",
                "vehicle__license_plate",
            )
        )
        return response.Response({"logs": list(logs)})

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
