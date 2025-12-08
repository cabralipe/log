from rest_framework import viewsets, permissions, filters
from fleet.models import Vehicle, VehicleMaintenance
from fleet.serializers import VehicleSerializer, VehicleMaintenanceSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsSameMunicipalityOrReadOnly, IsMunicipalityAdminOrReadOnly


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
