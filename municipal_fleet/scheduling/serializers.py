from django.utils import timezone
from rest_framework import serializers
from scheduling.models import DriverAvailabilityBlock


class DriverAvailabilityBlockSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.name", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)

    class Meta:
        model = DriverAvailabilityBlock
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "municipality", "driver_name", "created_by_email"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        instance = getattr(self, "instance", None)
        driver = attrs.get("driver", getattr(instance, "driver", None))
        start = attrs.get("start_datetime", getattr(instance, "start_datetime", None))
        end = attrs.get("end_datetime", getattr(instance, "end_datetime", None))
        status = attrs.get("status", getattr(instance, "status", DriverAvailabilityBlock.Status.ACTIVE))

        if start and end and start >= end:
            raise serializers.ValidationError("Data/hora inicial deve ser anterior à final.")
        if driver and user and getattr(user, "role", None) != "SUPERADMIN":
            if driver.municipality_id != getattr(user, "municipality_id", None):
                raise serializers.ValidationError("Motorista precisa pertencer à mesma prefeitura do usuário.")
            attrs["municipality"] = user.municipality
        elif driver and "municipality" not in attrs and instance is None:
            # Garantir consistência de prefeitura quando superadmin cria.
            attrs["municipality"] = driver.municipality

        municipality = attrs.get("municipality", getattr(instance, "municipality", None))
        if driver and municipality and driver.municipality_id != getattr(municipality, "id", None):
            raise serializers.ValidationError("Motorista e bloqueio devem pertencer à mesma prefeitura.")

        if driver and start and end and status == DriverAvailabilityBlock.Status.ACTIVE:
            qs = DriverAvailabilityBlock.objects.filter(
                driver=driver,
                status=DriverAvailabilityBlock.Status.ACTIVE,
                start_datetime__lt=end,
                end_datetime__gt=start,
            )
            if instance:
                qs = qs.exclude(id=instance.id)
            if qs.exists():
                raise serializers.ValidationError("Já existe um bloqueio ativo para este motorista neste período.")

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user and getattr(user, "is_authenticated", False):
            validated_data["created_by"] = user
            if getattr(user, "role", None) != "SUPERADMIN":
                validated_data["municipality"] = user.municipality
        return super().create(validated_data)
