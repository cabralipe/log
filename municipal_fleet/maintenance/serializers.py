from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from maintenance.models import (
    InventoryMovement,
    InventoryPart,
    MaintenancePlan,
    ServiceOrder,
    ServiceOrderItem,
    ServiceOrderLabor,
    Tire,
    VehicleTire,
)


class InventoryPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryPart
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "average_cost", "municipality"]

    def validate(self, attrs):
        user = self.context["request"].user
        municipality = attrs.get("municipality") or getattr(self.instance, "municipality", None) or user.municipality
        sku = attrs.get("sku", getattr(self.instance, "sku", None))
        if municipality and sku:
            qs = InventoryPart.objects.filter(municipality=municipality, sku=sku)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"sku": "SKU já cadastrado para esta prefeitura."})
        return attrs


class InventoryMovementSerializer(serializers.ModelSerializer):
    part_detail = InventoryPartSerializer(source="part", read_only=True)

    class Meta:
        model = InventoryMovement
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        movement_type = attrs.get("type", getattr(self.instance, "type", None))
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        unit_cost = attrs.get("unit_cost", getattr(self.instance, "unit_cost", None))
        responsible_name = attrs.get("responsible_name", getattr(self.instance, "responsible_name", None))
        expected_return_date = attrs.get("expected_return_date", getattr(self.instance, "expected_return_date", None))

        if quantity is None or quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantidade deve ser maior que zero."})

        if movement_type in (InventoryMovement.MovementType.OUT, InventoryMovement.MovementType.LOAN):
            if not responsible_name:
                raise serializers.ValidationError({"responsible_name": "Responsável é obrigatório para saídas."})
            if movement_type == InventoryMovement.MovementType.LOAN and not expected_return_date:
                raise serializers.ValidationError({"expected_return_date": "Data de devolução é obrigatória para empréstimos."})

        if movement_type == InventoryMovement.MovementType.IN and unit_cost is None:
            raise serializers.ValidationError({"unit_cost": "Custo unitário é obrigatório para entradas."})

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        part = validated_data.get("part")
        if user.role != User.Roles.SUPERADMIN:
            validated_data["municipality"] = user.municipality
        elif "municipality" not in validated_data and part:
            validated_data["municipality"] = part.municipality
        if user.is_authenticated and "performed_by" not in validated_data:
            validated_data["performed_by"] = user
        return super().create(validated_data)


class ServiceOrderItemSerializer(serializers.ModelSerializer):
    part_detail = InventoryPartSerializer(source="part", read_only=True)

    class Meta:
        model = ServiceOrderItem
        fields = ["id", "service_order", "part", "part_detail", "quantity", "unit_cost", "total_cost", "created_at"]
        read_only_fields = ["id", "service_order", "total_cost", "created_at"]


class ServiceOrderLaborSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderLabor
        fields = ["id", "service_order", "description", "hours", "hourly_rate", "total_cost", "created_at"]
        read_only_fields = ["id", "service_order", "total_cost", "created_at"]


class ServiceOrderSerializer(serializers.ModelSerializer):
    items = ServiceOrderItemSerializer(many=True, required=False)
    labor = ServiceOrderLaborSerializer(many=True, required=False)
    vehicle_license_plate = serializers.CharField(source="vehicle.license_plate", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = "__all__"
        read_only_fields = [
            "id",
            "opened_by",
            "opened_at",
            "total_cost",
            "created_at",
            "updated_at",
            "vehicle_license_plate",
            "municipality",
        ]

    def validate(self, attrs):
        user = self.context["request"].user
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))
        if vehicle and municipality and vehicle.municipality_id != getattr(municipality, "id", municipality):
            raise serializers.ValidationError("Veículo e prefeitura precisam corresponder.")
        if user.role != User.Roles.SUPERADMIN:
            attrs["municipality"] = user.municipality
            if vehicle and vehicle.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Veículo precisa ser da mesma prefeitura do usuário.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        labor_data = validated_data.pop("labor", [])
        user = self.context["request"].user
        vehicle = validated_data["vehicle"]
        # municipality is read_only, so set it explicitly from vehicle
        validated_data["municipality"] = vehicle.municipality
        validated_data["opened_by"] = user if user.is_authenticated else None
        if "opened_at" not in validated_data:
            validated_data["opened_at"] = timezone.now()
        if "vehicle_odometer_open" not in validated_data:
            validated_data["vehicle_odometer_open"] = vehicle.odometer_current
        order = super().create(validated_data)
        self._sync_items(order, items_data)
        self._sync_labor(order, labor_data)
        order.sync_vehicle_status()
        order.update_totals()
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        labor_data = validated_data.pop("labor", None)
        if "municipality" in validated_data:
            validated_data.pop("municipality")
        order = super().update(instance, validated_data)
        self._sync_items(order, items_data)
        self._sync_labor(order, labor_data)
        order.sync_vehicle_status()
        order.update_totals()
        return order

    def _sync_items(self, order: ServiceOrder, items_data):
        if items_data is None:
            return
        for item_data in items_data:
            ServiceOrderItem.objects.create(service_order=order, **item_data)

    def _sync_labor(self, order: ServiceOrder, labor_data):
        if labor_data is None:
            return
        for labor in labor_data:
            ServiceOrderLabor.objects.create(service_order=order, **labor)


class MaintenancePlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenancePlan
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def create(self, validated_data):
        user = self.context["request"].user
        vehicle = validated_data.get("vehicle")
        if user.role != User.Roles.SUPERADMIN:
            validated_data["municipality"] = user.municipality
        elif "municipality" not in validated_data and vehicle:
            validated_data["municipality"] = vehicle.municipality
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "municipality" in validated_data:
            validated_data.pop("municipality")
        return super().update(instance, validated_data)


class TireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tire
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "total_km", "km_since_last_retread", "retread_count", "municipality"]

    def create(self, validated_data):
        user = self.context["request"].user
        if user.role != User.Roles.SUPERADMIN:
            validated_data["municipality"] = user.municipality
        return super().create(validated_data)


class VehicleTireSerializer(serializers.ModelSerializer):
    tire_code = serializers.CharField(source="tire.code", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.license_plate", read_only=True)

    class Meta:
        model = VehicleTire
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "tire_code", "vehicle_plate", "municipality"]

    def validate(self, attrs):
        user = self.context["request"].user
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        tire = attrs.get("tire", getattr(self.instance, "tire", None))
        if vehicle and tire and vehicle.municipality_id != tire.municipality_id:
            raise serializers.ValidationError("Pneu e veículo precisam ser da mesma prefeitura.")
        if user.role != User.Roles.SUPERADMIN:
            if vehicle and vehicle.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Veículo precisa ser da prefeitura do usuário.")
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        if user.role != User.Roles.SUPERADMIN:
            validated_data.setdefault("installed_odometer", validated_data["vehicle"].odometer_current)
            validated_data["municipality"] = user.municipality
        return super().create(validated_data)
