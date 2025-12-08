from rest_framework import viewsets, permissions, filters
from drivers.models import Driver
from drivers.serializers import DriverSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly


class DriverViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("municipality")
    serializer_class = DriverSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "cpf", "phone"]

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(municipality=user.municipality if user.role != "SUPERADMIN" else serializer.validated_data.get("municipality"))
