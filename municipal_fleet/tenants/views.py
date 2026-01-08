from rest_framework import viewsets, permissions, response, filters, status, views
from tenants.models import Municipality
from tenants.serializers import MunicipalitySerializer, MunicipalitySettingsSerializer
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


class MunicipalitySettingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        municipality = self._get_target_municipality(request)
        if not municipality:
            return response.Response({"detail": "Prefeitura não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        serializer = MunicipalitySettingsSerializer(municipality)
        return response.Response(serializer.data)

    def patch(self, request):
        municipality = self._get_target_municipality(request)
        if not municipality:
            return response.Response({"detail": "Prefeitura não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        if request.user.role not in ("SUPERADMIN", "ADMIN_MUNICIPALITY", "OPERATOR"):
            return response.Response({"detail": "Sem permissão."}, status=status.HTTP_403_FORBIDDEN)
        serializer = MunicipalitySettingsSerializer(municipality, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)

    def _get_target_municipality(self, request):
        user = request.user
        if user.role == "SUPERADMIN":
            municipality_id = request.query_params.get("municipality_id")
            if municipality_id:
                return Municipality.objects.filter(id=municipality_id).first()
            return None
        return user.municipality
