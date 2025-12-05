from rest_framework import viewsets, permissions
from tenants.models import Municipality
from tenants.serializers import MunicipalitySerializer
from accounts.permissions import IsSuperAdmin
from tenants.mixins import MunicipalityQuerysetMixin


class MunicipalityViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Municipality.objects.all()
    serializer_class = MunicipalitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "list"]:
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]
