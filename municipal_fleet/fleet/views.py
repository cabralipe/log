from rest_framework import viewsets, permissions, filters
from rest_framework import parsers
from fleet.models import Vehicle, VehicleMaintenance, FuelLog, FuelStation
from fleet.serializers import VehicleSerializer, VehicleMaintenanceSerializer, FuelLogSerializer, FuelStationSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly


class VehicleViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["license_plate", "brand", "model"]

    def perform_create(self, serializer):
        user = self.request.user
        if not IsMunicipalityAdminOrReadOnly().has_permission(self.request, self):
            self.permission_denied(self.request, message="Apenas admins podem criar veículos.")
        serializer.save(
            municipality=user.municipality
            if user.role != "SUPERADMIN"
            else serializer.validated_data.get("municipality")
        )


class VehicleMaintenanceViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = VehicleMaintenance.objects.select_related("vehicle", "vehicle__municipality")
    serializer_class = VehicleMaintenanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    municipality_field = "vehicle__municipality"
    filter_backends = [filters.SearchFilter]
    search_fields = ["vehicle__license_plate", "description"]


class FuelLogViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = FuelLog.objects.select_related("vehicle", "driver", "municipality")
    serializer_class = FuelLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    search_fields = ["fuel_station", "driver__name", "vehicle__license_plate"]

    def get_queryset(self):
        qs = super().get_queryset()
        driver_id = self.request.query_params.get("driver_id")
        vehicle_id = self.request.query_params.get("vehicle_id")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if start_date:
            qs = qs.filter(filled_at__gte=start_date)
        if end_date:
            qs = qs.filter(filled_at__lte=end_date)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        municipality = user.municipality
        if getattr(user, "role", None) == "SUPERADMIN":
            municipality = (
                serializer.validated_data.get("municipality")
                or getattr(serializer.validated_data.get("vehicle"), "municipality", None)
                or getattr(serializer.validated_data.get("driver"), "municipality", None)
            )
        serializer.save(municipality=municipality)


class FuelStationViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = FuelStation.objects.select_related("municipality")
    serializer_class = FuelStationSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "cnpj", "address"]

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            municipality=user.municipality
            if user.role != "SUPERADMIN"
            else serializer.validated_data.get("municipality")
        )
