import datetime
from rest_framework import serializers
from django.utils import timezone
from fleet.models import Vehicle, VehicleMaintenance, FuelLog, FuelStation


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
        read_only_fields = ["id", "created_at", "municipality"]
        extra_kwargs = {
            "receipt_image": {"required": False},
            "driver": {"required": False},
        }

    def validate(self, attrs):
        request = self.context.get("request")
        portal_driver = self.context.get("portal_driver")
        user = getattr(request, "user", None)
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        liters = attrs.get("liters", getattr(self.instance, "liters", 0))
        station = attrs.get("fuel_station_ref", getattr(self.instance, "fuel_station_ref", None))

        if liters is not None and liters <= 0:
            raise serializers.ValidationError("Quantidade de litros deve ser maior que zero.")

        if driver and vehicle and driver.municipality_id != vehicle.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")

        if portal_driver:
            if not vehicle:
                raise serializers.ValidationError("Selecione o veículo abastecido.")
            if vehicle.municipality_id != portal_driver.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do motorista.")
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
        return attrs


class FuelStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelStation
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"read_only": True}}
