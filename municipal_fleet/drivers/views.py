from rest_framework import viewsets, permissions
from drivers.models import Driver
from drivers.serializers import DriverSerializer
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly


class DriverViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("municipality")
    serializer_class = DriverSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
