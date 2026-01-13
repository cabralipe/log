from rest_framework import viewsets, permissions, exceptions, filters
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly
from health.models import Patient, Companion
from health.serializers import PatientSerializer, CompanionSerializer


class BaseMunicipalityCreateMixin:
    def get_municipality(self, serializer):
        user = self.request.user
        if user.role == "SUPERADMIN":
            return serializer.validated_data.get("municipality")
        return user.municipality


class PatientViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Patient.objects.select_related("municipality")
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["full_name", "cpf"]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        serializer.save(municipality=municipality)


class CompanionViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Companion.objects.select_related("municipality", "patient")
    serializer_class = CompanionSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["full_name", "cpf", "patient__full_name"]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        patient = serializer.validated_data.get("patient")
        if patient and municipality and patient.municipality_id != municipality.id:
            raise exceptions.ValidationError("Paciente precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)

    def perform_update(self, serializer):
        municipality = self.get_municipality(serializer)
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        if patient and municipality and patient.municipality_id != municipality.id:
            raise exceptions.ValidationError("Paciente precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)
