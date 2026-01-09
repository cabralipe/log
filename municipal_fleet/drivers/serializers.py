from rest_framework import serializers
from drivers.models import Driver, DriverGeofence


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_cnh_expiration_date(self, value):
        from django.utils import timezone

        if value < timezone.now().date():
            raise serializers.ValidationError("CNH expirada.")
        return value


class DriverGeofenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverGeofence
        fields = [
            "id",
            "center_lat",
            "center_lng",
            "radius_m",
            "is_active",
            "alert_active",
            "last_alerted_at",
            "cleared_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "alert_active", "last_alerted_at", "cleared_at", "created_at", "updated_at"]
