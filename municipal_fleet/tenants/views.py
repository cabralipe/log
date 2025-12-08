from rest_framework import viewsets, permissions, response, filters
from tenants.models import Municipality
from tenants.serializers import MunicipalitySerializer
from accounts.permissions import IsSuperAdmin
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.models import User
from fleet.models import Vehicle
from drivers.models import Driver
from trips.models import Trip


class MunicipalityViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Municipality.objects.all()
    serializer_class = MunicipalitySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "city"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "list"]:
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        municipality = self.get_object()
        has_dependents = (
            User.objects.filter(municipality=municipality).exists()
            or Vehicle.objects.filter(municipality=municipality).exists()
            or Driver.objects.filter(municipality=municipality).exists()
            or Trip.objects.filter(municipality=municipality).exists()
        )
        if has_dependents:
            return response.Response(
                {"detail": "Não é possível apagar prefeitura com dados associados."},
                status=403,
            )
        return super().destroy(request, *args, **kwargs)
