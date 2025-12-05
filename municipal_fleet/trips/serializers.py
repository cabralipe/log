from datetime import datetime
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from trips.models import Trip, MonthlyOdometer
from fleet.models import Vehicle
from drivers.models import Driver


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        passengers = attrs.get("passengers_count", getattr(self.instance, "passengers_count", 0))
        status = attrs.get("status", getattr(self.instance, "status", Trip.Status.PLANNED))
        departure = attrs.get("departure_datetime", getattr(self.instance, "departure_datetime", None))
        return_expected = attrs.get("return_datetime_expected", getattr(self.instance, "return_datetime_expected", None))
        odometer_start = attrs.get("odometer_start", getattr(self.instance, "odometer_start", None))
        odometer_end = attrs.get("odometer_end", getattr(self.instance, "odometer_end", None))

        if vehicle and passengers and passengers > vehicle.max_passengers:
            raise serializers.ValidationError("Quantidade de passageiros excede a capacidade do veículo.")
        if vehicle and driver and vehicle.municipality_id != driver.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")
        if user and user.role != "SUPERADMIN":
            if vehicle and vehicle.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do usuário.")
            if driver and driver.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Motorista precisa pertencer à prefeitura do usuário.")
        if status == Trip.Status.COMPLETED:
            if odometer_end is None:
                raise serializers.ValidationError("odometer_end é obrigatório para concluir a viagem.")
            if odometer_end < odometer_start:
                raise serializers.ValidationError("Quilometragem final não pode ser menor que a inicial.")

        if departure and return_expected and return_expected <= departure:
            raise serializers.ValidationError("Data/horário de retorno deve ser após a saída.")

        if vehicle and departure and return_expected and status in [Trip.Status.PLANNED, Trip.Status.IN_PROGRESS]:
            qs = Trip.objects.filter(
                vehicle=vehicle,
                status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
                departure_datetime__lt=return_expected,
                return_datetime_expected__gt=departure,
            )
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("Conflito de agenda: veículo já está em outra viagem.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["municipality"] = user.municipality if user.role != "SUPERADMIN" else validated_data.get("municipality")
        trip = super().create(validated_data)
        self._update_odometer(trip)
        return trip

    @transaction.atomic
    def update(self, instance, validated_data):
        trip = super().update(instance, validated_data)
        self._update_odometer(trip)
        return trip

    def _update_odometer(self, trip: Trip):
        if trip.status != Trip.Status.COMPLETED or trip.odometer_end is None:
            return
        distance = trip.odometer_end - trip.odometer_start
        if distance < 0:
            return
        vehicle = trip.vehicle
        vehicle.odometer_current = trip.odometer_end
        vehicle.save(update_fields=["odometer_current"])
        now = timezone.localtime(trip.departure_datetime)
        summary, _ = MonthlyOdometer.objects.get_or_create(vehicle=vehicle, year=now.year, month=now.month)
        summary.add_distance(distance)
        if vehicle.odometer_monthly_limit and summary.kilometers > vehicle.odometer_monthly_limit:
            # Simplified flag via vehicle status hint
            vehicle.status = Vehicle.Status.MAINTENANCE
            vehicle.save(update_fields=["status"])
