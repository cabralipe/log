from rest_framework import serializers
from accounts.models import User
from drivers.models import Driver, DriverGeofence


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"municipality": {"required": False}}

    def validate_cnh_expiration_date(self, value):
        from django.utils import timezone

        if value < timezone.now().date():
            raise serializers.ValidationError("CNH expirada.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))
        if user and getattr(user, "role", None) != "SUPERADMIN":
            if not getattr(user, "municipality", None):
                raise serializers.ValidationError(
                    {"municipality": "Usuário precisa estar vinculado a uma prefeitura."}
                )
            attrs["municipality"] = user.municipality
        elif user and getattr(user, "role", None) == "SUPERADMIN" and not municipality:
            raise serializers.ValidationError({"municipality": "Prefeitura é obrigatória."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.role != User.Roles.SUPERADMIN:
            if not getattr(user, "municipality", None):
                raise serializers.ValidationError({"municipality": "Usuário precisa estar vinculado a uma prefeitura."})
            validated_data["municipality"] = user.municipality
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.role != User.Roles.SUPERADMIN and "municipality" in validated_data:
            validated_data.pop("municipality")
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        photo = data.get("photo")
        if request and photo:
            data["photo"] = request.build_absolute_uri(photo)
        return data


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
