from rest_framework import viewsets, permissions, filters, response, status
from rest_framework.decorators import action
from contracts.models import Contract, ContractVehicle, RentalPeriod
from contracts.serializers import (
    ContractSerializer,
    ContractVehicleSerializer,
    RentalPeriodSerializer,
    RentalPeriodCloseSerializer,
)
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly


class ContractViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Contract.objects.select_related("municipality")
    serializer_class = ContractSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["contract_number", "provider_name", "description"]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        status_filter = params.get("status")
        type_filter = params.get("type")
        provider = params.get("provider_name")
        contract_number = params.get("contract_number")
        start = params.get("start_date")
        end = params.get("end_date")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if type_filter:
            qs = qs.filter(type=type_filter)
        if provider:
            qs = qs.filter(provider_name__icontains=provider)
        if contract_number:
            qs = qs.filter(contract_number__icontains=contract_number)
        if start:
            qs = qs.filter(end_date__gte=start)
        if end:
            qs = qs.filter(start_date__lte=end)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        municipality = user.municipality if user.role != "SUPERADMIN" else serializer.validated_data.get("municipality")
        serializer.save(municipality=municipality)

    def perform_update(self, serializer):
        user = self.request.user
        municipality = user.municipality if user.role != "SUPERADMIN" else serializer.validated_data.get("municipality", serializer.instance.municipality)
        serializer.save(municipality=municipality)


class ContractVehicleViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = ContractVehicle.objects.select_related("contract", "vehicle", "municipality")
    serializer_class = ContractVehicleSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        contract_id = params.get("contract")
        vehicle_id = params.get("vehicle")
        if contract_id:
            qs = qs.filter(contract_id=contract_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return qs

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class RentalPeriodViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = RentalPeriod.objects.select_related("contract", "vehicle", "municipality")
    serializer_class = RentalPeriodSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        contract_id = params.get("contract")
        vehicle_id = params.get("vehicle")
        status_filter = params.get("status")
        start = params.get("start_date")
        end = params.get("end_date")
        if contract_id:
            qs = qs.filter(contract_id=contract_id)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if start:
            qs = qs.filter(start_datetime__gte=start)
        if end:
            qs = qs.filter(end_datetime__lte=end)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        municipality = user.municipality if user.role != "SUPERADMIN" else serializer.validated_data.get("municipality")
        serializer.save(municipality=municipality)

    @action(detail=True, methods=["patch"], url_path="close")
    def close_period(self, request, pk=None):
        period = self.get_object()
        serializer = RentalPeriodCloseSerializer(instance=period, data=request.data, context={"request": request}, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(RentalPeriodSerializer(period, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="invoice")
    def invoice(self, request, pk=None):
        period = self.get_object()
        period.status = RentalPeriod.Status.INVOICED
        period.save(update_fields=["status"])
        return response.Response(RentalPeriodSerializer(period, context={"request": request}).data)
