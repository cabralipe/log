import datetime
from rest_framework import serializers
from fleet.models import Vehicle, VehicleMaintenance


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
        if odometer_current < odometer_initial:
            raise serializers.ValidationError("Quilometragem atual não pode ser menor que a inicial.")
        return attrs


class VehicleMaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleMaintenance
        fields = "__all__"
        read_only_fields = ["id", "created_at"]
