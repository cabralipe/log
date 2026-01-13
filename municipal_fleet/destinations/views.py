from rest_framework import viewsets, permissions, filters
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly
from destinations.models import Destination
from destinations.serializers import DestinationSerializer


class DestinationViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Destination.objects.select_related("municipality")
    serializer_class = DestinationSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "address", "district", "city", "state"]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "SUPERADMIN":
            serializer.save(municipality=serializer.validated_data.get("municipality"))
        else:
            serializer.save(municipality=user.municipality)
