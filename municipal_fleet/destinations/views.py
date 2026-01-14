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

    def get_queryset(self):
        qs = super().get_queryset()
        dest_type = self.request.query_params.get("type")
        if dest_type:
            qs = qs.filter(type=dest_type)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "SUPERADMIN":
            serializer.save(municipality=serializer.validated_data.get("municipality"))
        else:
            serializer.save(municipality=user.municipality)
