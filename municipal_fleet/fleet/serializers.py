import datetime
import json
from rest_framework import serializers
from django.utils import timezone
from fleet.models import (
    Vehicle,
    VehicleMaintenance,
    FuelLog,
    FuelStation,
    VehicleInspection,
    VehicleInspectionDamagePhoto,
    FuelProduct,
    FuelStationLimit,
    FuelRule,
    FuelAlert,
    FuelInvoice,
)


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_year(self, value):
        current_year = datetime.date.today().year
        if value > current_year:
            raise serializers.ValidationError("Ano do veículo não pode estar no futuro.")
        return value

    def validate(self, attrs):
        odometer_current = attrs.get("odometer_current", getattr(self.instance, "odometer_current", 0))
        odometer_initial = attrs.get("odometer_initial", getattr(self.instance, "odometer_initial", 0))
        current_contract = attrs.get("current_contract", getattr(self.instance, "current_contract", None))
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))

        if odometer_current < odometer_initial:
            raise serializers.ValidationError("Quilometragem atual não pode ser menor que a inicial.")

        if current_contract:
            if municipality and current_contract.municipality_id != municipality.id:
                raise serializers.ValidationError("Contrato atual deve ser da mesma prefeitura do veículo.")
            if current_contract.status != current_contract.Status.ACTIVE:
                raise serializers.ValidationError("Contrato atual precisa estar ativo.")
            if current_contract.end_date and current_contract.end_date < timezone.localdate():
                raise serializers.ValidationError("Contrato atual está vencido.")

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        image = data.get("image")
        if request and image:
            data["image"] = request.build_absolute_uri(image)
        return data


class VehicleMaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleMaintenance
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class FuelLogSerializer(serializers.ModelSerializer):
    fuel_station_id = serializers.PrimaryKeyRelatedField(
        queryset=FuelStation.objects.all(),
        source="fuel_station_ref",
        required=False,
        allow_null=True,
    )

    class Meta:
        model = FuelLog
        fields = "__all__"
        read_only_fields = ["id", "created_at", "municipality", "total_cost"]
        extra_kwargs = {
            "receipt_image": {"required": False},
            "driver": {"required": False},
            "fuel_station": {"required": False},
        }

    def validate(self, attrs):
        request = self.context.get("request")
        portal_driver = self.context.get("portal_driver")
        user = getattr(request, "user", None)
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        liters = attrs.get("liters", getattr(self.instance, "liters", 0))
        price_per_liter = attrs.get("price_per_liter", getattr(self.instance, "price_per_liter", None))
        station = attrs.get("fuel_station_ref", getattr(self.instance, "fuel_station_ref", None))
        odometer = attrs.get("odometer", getattr(self.instance, "odometer", None))

        if liters is not None and liters <= 0:
            raise serializers.ValidationError("Quantidade de litros deve ser maior que zero.")
        if price_per_liter is None and not self.instance:
            raise serializers.ValidationError({"price_per_liter": "Preço por litro é obrigatório."})
        if price_per_liter is not None and price_per_liter <= 0:
            raise serializers.ValidationError({"price_per_liter": "Preço por litro deve ser maior que zero."})

        if driver and vehicle and driver.municipality_id != vehicle.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")

        if portal_driver:
            if not vehicle:
                raise serializers.ValidationError("Selecione o veículo abastecido.")
            if vehicle.municipality_id != portal_driver.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do motorista.")
            if odometer is not None and vehicle.odometer_current and odometer < vehicle.odometer_current:
                raise serializers.ValidationError("Odômetro informado não pode ser menor que o atual do veículo.")
            if station:
                if station.municipality_id != portal_driver.municipality_id:
                    raise serializers.ValidationError("Posto precisa pertencer à prefeitura do motorista.")
                if not station.active:
                    raise serializers.ValidationError("Posto indisponível.")
                attrs["fuel_station"] = station.name
            else:
                raise serializers.ValidationError("Selecione um posto credenciado.")
            attrs["driver"] = portal_driver
            attrs["municipality"] = portal_driver.municipality
            if price_per_liter is not None and liters:
                attrs["total_cost"] = price_per_liter * liters
            return attrs

        if not driver:
            raise serializers.ValidationError({"driver": "Motorista é obrigatório."})
        if user and getattr(user, "role", None) != "SUPERADMIN":
            if driver and driver.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Motorista precisa pertencer à prefeitura do usuário.")
            if vehicle and vehicle.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do usuário.")
            if station and station.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Posto precisa pertencer à prefeitura do usuário.")
        if station and not station.active:
            raise serializers.ValidationError("Posto indisponível.")
        if station and not attrs.get("fuel_station"):
            attrs["fuel_station"] = station.name
        if not station and not attrs.get("fuel_station"):
            raise serializers.ValidationError("Posto é obrigatório.")
        if price_per_liter is not None and liters:
            attrs["total_cost"] = price_per_liter * liters
        return attrs

    def create(self, validated_data):
        # municipality is read_only, so ensure it's set from vehicle
        vehicle = validated_data.get("vehicle")
        if vehicle and "municipality" not in validated_data:
            validated_data["municipality"] = vehicle.municipality
        fuel_log = super().create(validated_data)
        odometer = fuel_log.odometer
        if odometer is not None and vehicle:
            current = vehicle.odometer_current or 0
            if odometer > current:
                vehicle.odometer_current = odometer
                vehicle.save(update_fields=["odometer_current"])
        return fuel_log


    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        receipt_image = data.get("receipt_image")
        if request and receipt_image:
            data["receipt_image"] = request.build_absolute_uri(receipt_image)
        return data


class FuelStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelStation
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]


class FuelProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelProduct
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]


class FuelStationLimitSerializer(serializers.ModelSerializer):
    fuel_station_name = serializers.CharField(source="fuel_station.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = FuelStationLimit
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class FuelRuleSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source="vehicle.license_plate", read_only=True)
    contract_number = serializers.CharField(source="contract.contract_number", read_only=True)

    class Meta:
        model = FuelRule
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class FuelAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelAlert
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class FuelInvoiceSerializer(serializers.ModelSerializer):
    fuel_station_name = serializers.CharField(source="fuel_station.name", read_only=True)

    class Meta:
        model = FuelInvoice
        fields = "__all__"
        read_only_fields = ["id", "created_at", "municipality"]


class VehicleInspectionDamagePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleInspectionDamagePhoto
        fields = "__all__"
        read_only_fields = ["id", "created_at", "inspection"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and data.get("image"):
            data["image"] = request.build_absolute_uri(data["image"])
        return data


class VehicleInspectionSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source="vehicle.license_plate", read_only=True)
    driver_name = serializers.CharField(source="driver.name", read_only=True)
    damage_photos = VehicleInspectionDamagePhotoSerializer(many=True, read_only=True)

    class Meta:
        model = VehicleInspection
        fields = "__all__"
        read_only_fields = ["id", "created_at", "municipality"]
        extra_kwargs = {
            "signature_image": {"required": False},
            "checklist_items": {"required": False},
        }

    def _parse_checklist(self, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("Checklist inválido.") from exc
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        portal_driver = self.context.get("portal_driver")
        user = getattr(request, "user", None)
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        inspected_at = attrs.get("inspected_at", getattr(self.instance, "inspected_at", None)) or timezone.now()
        inspection_date = attrs.get("inspection_date", getattr(self.instance, "inspection_date", None))
        checklist_items = attrs.get("checklist_items", getattr(self.instance, "checklist_items", []))
        signature_image = attrs.get("signature_image", getattr(self.instance, "signature_image", None))
        signature_name = attrs.get("signature_name", getattr(self.instance, "signature_name", ""))

        checklist_items = self._parse_checklist(checklist_items)
        if not isinstance(checklist_items, list) or not checklist_items:
            raise serializers.ValidationError({"checklist_items": "Checklist diário é obrigatório."})
        attrs["checklist_items"] = checklist_items

        if not inspection_date:
            inspection_date = timezone.localdate(inspected_at)
            attrs["inspection_date"] = inspection_date

        if portal_driver:
            if not vehicle:
                raise serializers.ValidationError({"vehicle": "Selecione o veículo."})
            if vehicle.municipality_id != portal_driver.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do motorista.")
            attrs["driver"] = portal_driver
            attrs["municipality"] = portal_driver.municipality
        else:
            if not driver:
                raise serializers.ValidationError({"driver": "Motorista é obrigatório."})
            if user and getattr(user, "role", None) != "SUPERADMIN":
                if driver and driver.municipality_id != user.municipality_id:
                    raise serializers.ValidationError("Motorista precisa pertencer à prefeitura do usuário.")
                if vehicle and vehicle.municipality_id != user.municipality_id:
                    raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do usuário.")

        if not signature_image:
            raise serializers.ValidationError({"signature_image": "Assinatura do motorista é obrigatória."})
        if not signature_name:
            raise serializers.ValidationError({"signature_name": "Nome do motorista é obrigatório."})

        if vehicle and inspection_date:
            qs = VehicleInspection.objects.filter(vehicle=vehicle, inspection_date=inspection_date)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("Checklist diário já registrado para este veículo.")

        has_issue = any(
            str(item.get("status", "")).upper() in {"ISSUE", "FAIL", "NOK", "PROBLEM"}
            for item in checklist_items
            if isinstance(item, dict)
        )
        if request and request.FILES.getlist("damage_photos"):
            has_issue = True
        if not attrs.get("condition_status") and not getattr(self.instance, "condition_status", None):
            attrs["condition_status"] = (
                VehicleInspection.ConditionStatus.ATTENTION if has_issue else VehicleInspection.ConditionStatus.OK
            )

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        signature_image = data.get("signature_image")
        if request and signature_image:
            data["signature_image"] = request.build_absolute_uri(signature_image)
        return data
