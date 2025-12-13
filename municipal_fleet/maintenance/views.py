from django.db import models, transaction
from django.utils import timezone
from rest_framework import decorators, permissions, response, status, viewsets, filters

from accounts.models import User
from maintenance.models import (
    InventoryMovement,
    InventoryPart,
    MaintenancePlan,
    ServiceOrder,
    Tire,
    VehicleTire,
)
from maintenance.permissions import IsMaintenanceEditor
from maintenance.serializers import (
    InventoryMovementSerializer,
    InventoryPartSerializer,
    MaintenancePlanSerializer,
    ServiceOrderSerializer,
    TireSerializer,
    VehicleTireSerializer,
)
from tenants.mixins import MunicipalityQuerysetMixin


class ServiceOrderViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = ServiceOrder.objects.select_related("vehicle", "municipality").prefetch_related("items", "labor")
    serializer_class = ServiceOrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceEditor]
    municipality_field = "vehicle__municipality"
    filter_backends = [filters.SearchFilter]
    search_fields = ["description", "vehicle__license_plate", "provider_name"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        type_param = self.request.query_params.get("type")
        vehicle_id = self.request.query_params.get("vehicle")
        if status_param:
            qs = qs.filter(status=status_param)
        if type_param:
            qs = qs.filter(type=type_param)
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return qs

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in (User.Roles.SUPERADMIN, User.Roles.ADMIN_MUNICIPALITY):
            return response.Response(
                {"detail": "Somente administradores podem excluir ordens de serviço."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @decorators.action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        order = self.get_object()
        order.mark_started()
        serializer = self.get_serializer(order)
        return response.Response(serializer.data)

    @decorators.action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        order: ServiceOrder = self.get_object()
        with transaction.atomic():
            odometer_close = request.data.get("vehicle_odometer_close")
            if odometer_close is not None:
                order.vehicle_odometer_close = odometer_close
            notes = request.data.get("notes")
            if notes is not None:
                order.notes = notes
                order.save(update_fields=["notes", "updated_at"])
            order.mark_completed(order.vehicle_odometer_close)
            if order.type == ServiceOrder.Type.PREVENTIVE:
                self._update_preventive_plans(order)
            if order.type == ServiceOrder.Type.TIRE:
                self._apply_tire_actions(order, request.data)
        serializer = self.get_serializer(order)
        return response.Response(serializer.data)

    def _update_preventive_plans(self, order: ServiceOrder):
        MaintenancePlan.objects.filter(vehicle=order.vehicle, is_active=True).update(
            last_service_odometer=order.vehicle_odometer_close or order.vehicle.odometer_current,
            last_service_date=timezone.localdate(),
            updated_at=timezone.now(),
        )

    def _apply_tire_actions(self, order: ServiceOrder, payload):
        retread_ids = payload.get("retread_tires") or []
        scrap_ids = payload.get("scrap_tires") or []
        VehicleTire.objects.filter(vehicle=order.vehicle, active=True, tire_id__in=retread_ids).update(
            active=False, removed_at=timezone.now(), removed_odometer=order.vehicle_odometer_close
        )
        if retread_ids:
            Tire.objects.filter(id__in=retread_ids).update(
                status=Tire.Status.RETREADED, km_since_last_retread=0, retread_count=models.F("retread_count") + 1
            )
        if scrap_ids:
            VehicleTire.objects.filter(vehicle=order.vehicle, active=True, tire_id__in=scrap_ids).update(
                active=False, removed_at=timezone.now(), removed_odometer=order.vehicle_odometer_close
            )
            Tire.objects.filter(id__in=scrap_ids).update(status=Tire.Status.SCRAPPED)


class InventoryPartViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = InventoryPart.objects.all()
    serializer_class = InventoryPartSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceEditor]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "sku"]

    def perform_create(self, serializer):
        user = self.request.user
        municipality = serializer.validated_data.get("municipality") or user.municipality
        serializer.save(municipality=municipality)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in (User.Roles.SUPERADMIN, User.Roles.ADMIN_MUNICIPALITY):
            return response.Response(
                {"detail": "Somente administradores podem excluir peças."}, status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class InventoryMovementViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = InventoryMovement.objects.select_related("part", "municipality")
    serializer_class = InventoryMovementSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceEditor]
    filter_backends = [filters.SearchFilter]
    search_fields = ["reference", "part__name", "part__sku"]

    def get_queryset(self):
        qs = super().get_queryset()
        movement_type = self.request.query_params.get("type")
        part = self.request.query_params.get("part")
        if movement_type:
            qs = qs.filter(type=movement_type)
        if part:
            qs = qs.filter(part_id=part)
        return qs


class MaintenancePlanViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = MaintenancePlan.objects.select_related("vehicle", "municipality")
    serializer_class = MaintenancePlanSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceEditor]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "vehicle__license_plate"]


class TireViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Tire.objects.all()
    serializer_class = TireSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceEditor]
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "brand", "model"]


class VehicleTireViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = VehicleTire.objects.select_related("tire", "vehicle")
    serializer_class = VehicleTireSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceEditor]
    municipality_field = "vehicle__municipality"
    filter_backends = [filters.SearchFilter]
    search_fields = ["vehicle__license_plate", "tire__code"]

    def get_queryset(self):
        qs = super().get_queryset()
        vehicle_id = self.request.query_params.get("vehicle")
        tire_id = self.request.query_params.get("tire")
        active = self.request.query_params.get("active")
        position = self.request.query_params.get("position")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        if tire_id:
            qs = qs.filter(tire_id=tire_id)
        if active is not None:
            if active in ("true", "True", True):
                qs = qs.filter(active=True)
            elif active in ("false", "False"):
                qs = qs.filter(active=False)
        if position:
            qs = qs.filter(position=position)
        return qs
