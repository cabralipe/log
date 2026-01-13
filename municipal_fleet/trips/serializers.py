from datetime import datetime
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from trips.models import (
    Trip,
    TripIncident,
    MonthlyOdometer,
    FreeTrip,
    FreeTripIncident,
    TripGpsPing,
    PlannedTrip,
    PlannedTripStop,
    PlannedTripPassenger,
    TripExecution,
    TripExecutionStop,
    TripManifest,
    TripManifestPassenger,
)
from contracts.models import Contract
from fleet.models import Vehicle
from drivers.models import Driver
from maintenance.services import handle_trip_completion
from scheduling.models import DriverAvailabilityBlock
from destinations.models import Destination
from students.models import Student
from health.models import Patient, Companion


SPECIAL_NEED_CHOICES = {"NONE", "TEA", "ELDERLY", "PCD", "OTHER"}


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is not None and not getattr(user, "is_authenticated", False):
            user = None
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        contract = attrs.get("contract", getattr(self.instance, "contract", None))
        rental_period = attrs.get("rental_period", getattr(self.instance, "rental_period", None))
        passengers_details = attrs.get("passengers_details", getattr(self.instance, "passengers_details", []))
        passengers = attrs.get("passengers_count", getattr(self.instance, "passengers_count", 0))
        status = attrs.get("status", getattr(self.instance, "status", Trip.Status.PLANNED))
        category = attrs.get("category", getattr(self.instance, "category", Trip.Category.PASSENGER))
        departure = attrs.get("departure_datetime", getattr(self.instance, "departure_datetime", None))
        return_expected = attrs.get("return_datetime_expected", getattr(self.instance, "return_datetime_expected", None))
        odometer_start = attrs.get("odometer_start", getattr(self.instance, "odometer_start", None))
        odometer_end = attrs.get("odometer_end", getattr(self.instance, "odometer_end", None))
        cargo_description = attrs.get("cargo_description", getattr(self.instance, "cargo_description", ""))
        cargo_size = attrs.get("cargo_size", getattr(self.instance, "cargo_size", ""))
        cargo_quantity = attrs.get("cargo_quantity", getattr(self.instance, "cargo_quantity", 0))
        cargo_purpose = attrs.get("cargo_purpose", getattr(self.instance, "cargo_purpose", ""))
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))

        if passengers_details:
            if not isinstance(passengers_details, list):
                raise serializers.ValidationError("passengers_details precisa ser uma lista.")
            cleaned_passengers = []
            for idx, item in enumerate(passengers_details):
                if not isinstance(item, dict):
                    raise serializers.ValidationError(f"Passageiro #{idx + 1} inválido.")
                name = item.get("name")
                cpf = item.get("cpf")
                age = item.get("age")
                special_need = item.get("special_need") or "NONE"
                observation = item.get("observation")
                special_need_other = item.get("special_need_other")
                if not name:
                    raise serializers.ValidationError(f"Nome do passageiro #{idx + 1} é obrigatório.")
                if not cpf:
                    raise serializers.ValidationError(f"CPF do passageiro #{idx + 1} é obrigatório.")
                if special_need not in SPECIAL_NEED_CHOICES:
                    raise serializers.ValidationError(f"Atendimento especial do passageiro #{idx + 1} é inválido.")
                if special_need == "OTHER" and not special_need_other:
                    raise serializers.ValidationError(f"Descreva o atendimento especial do passageiro #{idx + 1}.")
                if age is not None:
                    try:
                        age = int(age)
                    except (ValueError, TypeError):
                        raise serializers.ValidationError(f"Idade do passageiro #{idx + 1} é inválida.")
                cleaned_passengers.append(
                    {
                        "name": name,
                        "cpf": cpf,
                        "age": age,
                        "special_need": special_need,
                        "special_need_other": special_need_other,
                        "observation": observation,
                    }
                )
            passengers = len(cleaned_passengers)
            attrs["passengers_details"] = cleaned_passengers
            attrs["passengers_count"] = passengers

        if vehicle and vehicle.status == Vehicle.Status.MAINTENANCE:
            raise serializers.ValidationError("Veículo em manutenção não pode receber novas viagens.")
        if vehicle and passengers and passengers > vehicle.max_passengers:
            raise serializers.ValidationError("Quantidade de passageiros excede a capacidade do veículo.")
        if vehicle and driver and vehicle.municipality_id != driver.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")
        if driver and municipality and driver.municipality_id != getattr(municipality, "id", None):
            raise serializers.ValidationError("Motorista precisa pertencer à mesma prefeitura da viagem.")
        if category in (Trip.Category.OBJECT, Trip.Category.MIXED):
            missing_fields = []
            if not cargo_description:
                missing_fields.append("cargo_description")
            if not cargo_size:
                missing_fields.append("cargo_size")
            if not cargo_purpose:
                missing_fields.append("cargo_purpose")
            if cargo_quantity is None or cargo_quantity < 1:
                missing_fields.append("cargo_quantity")
            if missing_fields:
                raise serializers.ValidationError(
                    {field: "Obrigatório quando a categoria envolve objeto." for field in missing_fields}
                )
        if category == Trip.Category.OBJECT:
            attrs["passengers_count"] = 0
            attrs["passengers_details"] = []

        if rental_period:
            if contract and rental_period.contract_id != getattr(contract, "id", None):
                raise serializers.ValidationError("Período de locação pertence a outro contrato.")
            contract = contract or rental_period.contract
            attrs["contract"] = contract
            if rental_period.vehicle and vehicle and rental_period.vehicle_id != vehicle.id:
                raise serializers.ValidationError("Período de locação vinculado a outro veículo.")
            if departure and rental_period.start_datetime and departure < rental_period.start_datetime:
                raise serializers.ValidationError("Viagem começa antes do período de locação.")
            if return_expected and rental_period.end_datetime and return_expected > rental_period.end_datetime:
                raise serializers.ValidationError("Viagem termina após o período de locação.")

        if contract:
            if contract.status != Contract.Status.ACTIVE:
                raise serializers.ValidationError("Contrato informado precisa estar ativo.")
            if contract.end_date and contract.end_date < timezone.localdate():
                raise serializers.ValidationError("Contrato informado está vencido.")
            if vehicle and contract.municipality_id != vehicle.municipality_id:
                raise serializers.ValidationError("Contrato precisa ser da mesma prefeitura do veículo.")
            if driver and contract.municipality_id != driver.municipality_id:
                raise serializers.ValidationError("Contrato precisa ser da mesma prefeitura do motorista.")

        if user and getattr(user, "role", None) != "SUPERADMIN":
            if vehicle and vehicle.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do usuário.")
            if driver and driver.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Motorista precisa pertencer à prefeitura do usuário.")
            if contract and contract.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Contrato precisa pertencer à prefeitura do usuário.")
        if status == Trip.Status.COMPLETED and not self.context.get("portal_driver"):
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
        if driver and departure and return_expected and status in [Trip.Status.PLANNED, Trip.Status.IN_PROGRESS]:
            driver_qs = Trip.objects.filter(
                driver=driver,
                status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
                departure_datetime__lt=return_expected,
                return_datetime_expected__gt=departure,
            )
            if self.instance:
                driver_qs = driver_qs.exclude(id=self.instance.id)
            if driver_qs.exists():
                raise serializers.ValidationError("Conflito de agenda: motorista já está em outra viagem.")
            block_qs = DriverAvailabilityBlock.objects.filter(
                driver=driver,
                status=DriverAvailabilityBlock.Status.ACTIVE,
                start_datetime__lt=return_expected,
                end_datetime__gt=departure,
            )
            if block_qs.exists():
                block = block_qs.first()
                start_fmt = timezone.localtime(block.start_datetime).strftime("%d/%m %H:%M")
                end_fmt = timezone.localtime(block.end_datetime).strftime("%d/%m %H:%M")
                raise serializers.ValidationError(
                    f"Motorista indisponível ({block.get_type_display()}) de {start_fmt} até {end_fmt}."
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request_user = getattr(self.context.get("request"), "user", None)
        user = request_user if request_user and getattr(request_user, "is_authenticated", False) else None
        vehicle = validated_data.get("vehicle")
        contract = validated_data.get("contract")
        if not contract and vehicle and vehicle.current_contract and vehicle.current_contract.status == Contract.Status.ACTIVE:
            validated_data["contract"] = vehicle.current_contract
        if user and getattr(user, "role", None) != "SUPERADMIN":
            validated_data["municipality"] = user.municipality
        else:
            validated_data["municipality"] = validated_data.get("municipality")
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
        handle_trip_completion(vehicle, distance)


class TripIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripIncident
        fields = ["id", "trip", "driver", "municipality", "description", "created_at"]
        read_only_fields = ["id", "driver", "municipality", "created_at"]


class TripGpsPingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripGpsPing
        fields = ["id", "trip", "driver", "lat", "lng", "accuracy", "speed", "recorded_at", "created_at"]
        read_only_fields = ["id", "driver", "created_at"]


class FreeTripSerializer(serializers.ModelSerializer):
    distance = serializers.SerializerMethodField()
    driver_name = serializers.CharField(source="driver.name", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.license_plate", read_only=True)
    incidents_count = serializers.SerializerMethodField()
    incidents = serializers.SerializerMethodField()

    class Meta:
        model = FreeTrip
        fields = "__all__"
        read_only_fields = [
            "id",
            "municipality",
            "started_at",
            "ended_at",
            "created_at",
            "updated_at",
            "distance",
            "driver_name",
            "vehicle_plate",
            "incidents_count",
            "incidents",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        portal_driver = self.context.get("portal_driver")
        instance = getattr(self, "instance", None)

        driver = attrs.get("driver", getattr(instance, "driver", None))
        vehicle = attrs.get("vehicle", getattr(instance, "vehicle", None))
        odometer_start = attrs.get("odometer_start", getattr(instance, "odometer_start", None))
        odometer_end = attrs.get("odometer_end", getattr(instance, "odometer_end", None))
        status = attrs.get("status", getattr(instance, "status", FreeTrip.Status.OPEN))
        now = timezone.now()

        if portal_driver:
            driver = portal_driver
            attrs["driver"] = driver
            attrs["municipality"] = portal_driver.municipality
            if not portal_driver.free_trip_enabled:
                raise serializers.ValidationError("Viagem livre não liberada para este motorista.")
        elif user and getattr(user, "role", None) != "SUPERADMIN":
            attrs["municipality"] = user.municipality

        if not driver:
            raise serializers.ValidationError("Motorista é obrigatório.")
        if not vehicle:
            raise serializers.ValidationError("Veículo é obrigatório.")
        if vehicle.municipality_id != driver.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")
        if vehicle.status in [Vehicle.Status.MAINTENANCE, Vehicle.Status.INACTIVE]:
            raise serializers.ValidationError("Veículo está inativo/manutenção e não pode ser usado.")

        if user and getattr(user, "is_authenticated", False) and getattr(user, "role", None) != "SUPERADMIN":
            if driver.municipality_id != getattr(user, "municipality_id", None):
                raise serializers.ValidationError("Motorista precisa pertencer à prefeitura do usuário.")
            if vehicle.municipality_id != getattr(user, "municipality_id", None):
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do usuário.")

        if odometer_end is not None and odometer_start is not None and odometer_end < odometer_start:
            raise serializers.ValidationError("Quilometragem final não pode ser menor que a inicial.")

        target_driver = driver
        open_qs = FreeTrip.objects.filter(driver=target_driver, status=FreeTrip.Status.OPEN)
        if instance:
            open_qs = open_qs.exclude(id=instance.id)
        if not instance and status == FreeTrip.Status.OPEN and open_qs.exists():
            raise serializers.ValidationError("Já existe uma viagem livre em aberto para este motorista.")

        vehicle_open_qs = FreeTrip.objects.filter(vehicle=vehicle, status=FreeTrip.Status.OPEN)
        if instance:
            vehicle_open_qs = vehicle_open_qs.exclude(id=instance.id)
        if not instance and status == FreeTrip.Status.OPEN and vehicle_open_qs.exists():
            raise serializers.ValidationError("Este veículo já está em uma viagem livre em andamento.")

        # Respeita bloqueios cadastrados na agenda do motorista.
        if status == FreeTrip.Status.OPEN:
            block_qs = DriverAvailabilityBlock.objects.filter(
                driver=driver,
                status=DriverAvailabilityBlock.Status.ACTIVE,
                start_datetime__lte=now,
                end_datetime__gt=now,
            )
            if block_qs.exists():
                block = block_qs.first()
                start_fmt = timezone.localtime(block.start_datetime).strftime("%d/%m %H:%M")
                end_fmt = timezone.localtime(block.end_datetime).strftime("%d/%m %H:%M")
                raise serializers.ValidationError(
                    f"Motorista indisponível ({block.get_type_display()}) de {start_fmt} até {end_fmt}."
                )

        return attrs

    def create(self, validated_data):
        user = self.context.get("request").user if self.context.get("request") else None
        portal_driver = self.context.get("portal_driver")
        if portal_driver:
            validated_data["driver"] = portal_driver
            validated_data["municipality"] = portal_driver.municipality
        elif user and getattr(user, "role", None) != "SUPERADMIN":
            validated_data["municipality"] = user.municipality
        elif "municipality" not in validated_data and not portal_driver:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        closing = validated_data.get("status") == FreeTrip.Status.CLOSED or validated_data.get("odometer_end") is not None
        if closing and validated_data.get("odometer_end") is None and instance.odometer_end is None:
            raise serializers.ValidationError("odometer_end é obrigatório para encerrar a viagem livre.")
        free_trip = super().update(instance, validated_data)
        if closing:
            free_trip.status = FreeTrip.Status.CLOSED
            if free_trip.ended_at is None:
                free_trip.ended_at = timezone.now()
            free_trip.save(update_fields=["status", "ended_at", "odometer_end", "odometer_end_photo", "updated_at"])
            self._update_vehicle_odometer(free_trip)
        return free_trip

    def _update_vehicle_odometer(self, free_trip: FreeTrip):
        if free_trip.status != FreeTrip.Status.CLOSED or free_trip.odometer_end is None:
            return
        distance = free_trip.odometer_end - free_trip.odometer_start
        if distance < 0:
            return
        vehicle = free_trip.vehicle
        vehicle.odometer_current = free_trip.odometer_end
        vehicle.save(update_fields=["odometer_current"])
        reference_date = free_trip.ended_at or free_trip.started_at or timezone.now()
        summary, _ = MonthlyOdometer.objects.get_or_create(
            vehicle=vehicle, year=reference_date.year, month=reference_date.month
        )
        summary.add_distance(distance)
        if vehicle.odometer_monthly_limit and summary.kilometers > vehicle.odometer_monthly_limit:
            vehicle.status = Vehicle.Status.MAINTENANCE
            vehicle.save(update_fields=["status"])
        handle_trip_completion(vehicle, distance)

    def get_distance(self, obj: FreeTrip):
        return obj.distance

    def get_incidents(self, obj: FreeTrip):
        if not hasattr(obj, "incidents"):
            return []
        # Only include a small set for summaries
        recent = obj.incidents.all()[:5]
        return [{"id": inc.id, "description": inc.description, "created_at": inc.created_at} for inc in recent]

    def get_incidents_count(self, obj: FreeTrip):
        if hasattr(obj, "incidents"):
            return obj.incidents.count()
        return 0


class FreeTripIncidentSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.name", read_only=True)

    class Meta:
        model = FreeTripIncident
        fields = ["id", "free_trip", "driver", "driver_name", "municipality", "description", "created_at"]
        read_only_fields = ["id", "driver", "municipality", "created_at", "driver_name"]


class PlannedTripStopSerializer(serializers.ModelSerializer):
    destination_name = serializers.CharField(source="destination.name", read_only=True)

    class Meta:
        model = PlannedTripStop
        fields = ["id", "destination", "destination_name", "order", "notes"]
        read_only_fields = ["id"]


class PlannedTripPassengerSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    companion_name = serializers.CharField(source="companion.full_name", read_only=True)

    class Meta:
        model = PlannedTripPassenger
        fields = [
            "id",
            "passenger_type",
            "student",
            "patient",
            "companion",
            "student_name",
            "patient_name",
            "companion_name",
            "notes",
        ]
        read_only_fields = ["id", "student_name", "patient_name", "companion_name"]

    def validate(self, attrs):
        passenger_type = attrs.get("passenger_type", getattr(self.instance, "passenger_type", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        companion = attrs.get("companion", getattr(self.instance, "companion", None))
        filled = [bool(student), bool(patient), bool(companion)]
        if sum(filled) > 1:
            raise serializers.ValidationError("Informe apenas um vínculo de passageiro por registro.")
        if passenger_type == PlannedTripPassenger.PassengerType.STUDENT and not student:
            raise serializers.ValidationError("Aluno é obrigatório para passageiro do tipo aluno.")
        if passenger_type == PlannedTripPassenger.PassengerType.PATIENT and not patient:
            raise serializers.ValidationError("Paciente é obrigatório para passageiro do tipo paciente.")
        if passenger_type == PlannedTripPassenger.PassengerType.COMPANION and not companion:
            raise serializers.ValidationError("Acompanhante é obrigatório para passageiro do tipo acompanhante.")
        return attrs


class PlannedTripSerializer(serializers.ModelSerializer):
    stops = PlannedTripStopSerializer(many=True, required=False)
    passengers = PlannedTripPassengerSerializer(many=True, required=False)

    class Meta:
        model = PlannedTrip
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        departure_time = attrs.get("departure_time", getattr(self.instance, "departure_time", None))
        return_time = attrs.get("return_time_expected", getattr(self.instance, "return_time_expected", None))
        planned_capacity = attrs.get("planned_capacity", getattr(self.instance, "planned_capacity", 0))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError("Data de término deve ser após a data de início.")
        if departure_time and return_time and return_time == departure_time:
            raise serializers.ValidationError("Horário de retorno não pode ser igual ao de saída.")
        if vehicle and driver and vehicle.municipality_id != driver.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")
        if vehicle and planned_capacity and planned_capacity > vehicle.max_passengers:
            raise serializers.ValidationError("Capacidade planejada excede a capacidade do veículo.")
        return attrs

    def _validate_destination(self, destination, municipality_id):
        if destination and destination.municipality_id != municipality_id:
            raise serializers.ValidationError("Destino precisa pertencer à mesma prefeitura.")

    def _validate_passenger_municipality(self, passenger, municipality_id):
        if passenger.student and passenger.student.municipality_id != municipality_id:
            raise serializers.ValidationError("Aluno precisa pertencer à mesma prefeitura.")
        if passenger.patient and passenger.patient.municipality_id != municipality_id:
            raise serializers.ValidationError("Paciente precisa pertencer à mesma prefeitura.")
        if passenger.companion and passenger.companion.municipality_id != municipality_id:
            raise serializers.ValidationError("Acompanhante precisa pertencer à mesma prefeitura.")

    @transaction.atomic
    def create(self, validated_data):
        stops_data = validated_data.pop("stops", [])
        passengers_data = validated_data.pop("passengers", [])
        request_user = getattr(self.context.get("request"), "user", None)
        user = request_user if request_user and getattr(request_user, "is_authenticated", False) else None
        if user and user.role != "SUPERADMIN":
            validated_data["municipality"] = user.municipality
        elif not validated_data.get("municipality"):
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        plan = super().create(validated_data)
        municipality_id = plan.municipality_id
        for stop in stops_data:
            destination = stop.get("destination")
            if destination:
                self._validate_destination(destination, municipality_id)
            PlannedTripStop.objects.create(planned_trip=plan, **stop)
        for passenger in passengers_data:
            passenger_obj = PlannedTripPassenger(planned_trip=plan, **passenger)
            self._validate_passenger_municipality(passenger_obj, municipality_id)
            passenger_obj.save()
        return plan

    @transaction.atomic
    def update(self, instance, validated_data):
        stops_data = validated_data.pop("stops", None)
        passengers_data = validated_data.pop("passengers", None)
        request_user = getattr(self.context.get("request"), "user", None)
        user = request_user if request_user and getattr(request_user, "is_authenticated", False) else None
        if user and user.role != "SUPERADMIN" and "municipality" in validated_data:
            validated_data["municipality"] = user.municipality
        plan = super().update(instance, validated_data)
        municipality_id = plan.municipality_id
        if stops_data is not None:
            plan.stops.all().delete()
            for stop in stops_data:
                destination = stop.get("destination")
                if destination:
                    self._validate_destination(destination, municipality_id)
                PlannedTripStop.objects.create(planned_trip=plan, **stop)
        if passengers_data is not None:
            plan.passengers.all().delete()
            for passenger in passengers_data:
                passenger_obj = PlannedTripPassenger(planned_trip=plan, **passenger)
                self._validate_passenger_municipality(passenger_obj, municipality_id)
                passenger_obj.save()
        return plan


class TripExecutionStopSerializer(serializers.ModelSerializer):
    destination_name = serializers.CharField(source="destination.name", read_only=True)

    class Meta:
        model = TripExecutionStop
        fields = [
            "id",
            "destination",
            "destination_name",
            "order",
            "arrival_time",
            "departure_time",
            "notes",
        ]
        read_only_fields = ["id"]


class TripManifestPassengerSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    companion_name = serializers.CharField(source="companion.full_name", read_only=True)

    class Meta:
        model = TripManifestPassenger
        fields = [
            "id",
            "passenger_type",
            "student",
            "patient",
            "companion",
            "linked_patient",
            "student_name",
            "patient_name",
            "companion_name",
            "notes",
        ]
        read_only_fields = ["id", "student_name", "patient_name", "companion_name"]

    def validate(self, attrs):
        passenger_type = attrs.get("passenger_type", getattr(self.instance, "passenger_type", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        companion = attrs.get("companion", getattr(self.instance, "companion", None))
        linked_patient = attrs.get("linked_patient", getattr(self.instance, "linked_patient", None))
        filled = [bool(student), bool(patient), bool(companion)]
        if sum(filled) > 1:
            raise serializers.ValidationError("Informe apenas um vínculo de passageiro por registro.")

        if passenger_type == TripManifestPassenger.PassengerType.STUDENT and not student:
            raise serializers.ValidationError("Aluno é obrigatório para passageiro do tipo aluno.")
        if passenger_type == TripManifestPassenger.PassengerType.PATIENT and not patient:
            raise serializers.ValidationError("Paciente é obrigatório para passageiro do tipo paciente.")
        if passenger_type == TripManifestPassenger.PassengerType.COMPANION:
            if not companion:
                raise serializers.ValidationError("Acompanhante é obrigatório para passageiro do tipo acompanhante.")
            if not linked_patient:
                raise serializers.ValidationError("Vínculo com paciente é obrigatório para acompanhante.")
        return attrs


class TripManifestSerializer(serializers.ModelSerializer):
    passengers = TripManifestPassengerSerializer(many=True, required=False)

    class Meta:
        model = TripManifest
        fields = ["id", "trip_execution", "total_passengers", "notes", "passengers", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"trip_execution": {"required": False}}

    @transaction.atomic
    def create(self, validated_data):
        passengers_data = validated_data.pop("passengers", [])
        manifest = super().create(validated_data)
        if passengers_data:
            self._replace_passengers(manifest, passengers_data)
        return manifest

    @transaction.atomic
    def update(self, instance, validated_data):
        passengers_data = validated_data.pop("passengers", None)
        manifest = super().update(instance, validated_data)
        if passengers_data is not None:
            self._replace_passengers(manifest, passengers_data)
        return manifest

    def _replace_passengers(self, manifest, passengers_data):
        manifest.passengers.all().delete()
        for passenger in passengers_data:
            TripManifestPassenger.objects.create(manifest=manifest, **passenger)
        manifest.total_passengers = len(passengers_data)
        manifest.save(update_fields=["total_passengers", "updated_at"])


class TripExecutionSerializer(serializers.ModelSerializer):
    stops = TripExecutionStopSerializer(many=True, required=False)
    manifest = TripManifestSerializer(required=False)

    class Meta:
        model = TripExecution
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is not None and not getattr(user, "is_authenticated", False):
            user = None

        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        scheduled_departure = attrs.get(
            "scheduled_departure", getattr(self.instance, "scheduled_departure", None)
        )
        scheduled_return = attrs.get("scheduled_return", getattr(self.instance, "scheduled_return", None))
        status = attrs.get("status", getattr(self.instance, "status", TripExecution.Status.PLANNED))
        manifest_data = attrs.get("manifest")
        planned_capacity = attrs.get("planned_capacity", getattr(self.instance, "planned_capacity", 0))

        if scheduled_departure and scheduled_return and scheduled_return <= scheduled_departure:
            raise serializers.ValidationError("Data/horário de retorno deve ser após a saída.")
        if vehicle and vehicle.status == Vehicle.Status.MAINTENANCE:
            raise serializers.ValidationError("Veículo em manutenção não pode receber novas viagens.")
        if vehicle and planned_capacity and planned_capacity > vehicle.max_passengers:
            raise serializers.ValidationError("Capacidade planejada excede a capacidade do veículo.")
        if vehicle and driver and vehicle.municipality_id != driver.municipality_id:
            raise serializers.ValidationError("Motorista e veículo precisam ser da mesma prefeitura.")
        if user and user.role != "SUPERADMIN":
            if vehicle and vehicle.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Veículo precisa pertencer à prefeitura do usuário.")
            if driver and driver.municipality_id != user.municipality_id:
                raise serializers.ValidationError("Motorista precisa pertencer à prefeitura do usuário.")

        if self.instance and self.instance.status == TripExecution.Status.COMPLETED:
            immutable_fields = {
                "scheduled_departure",
                "scheduled_return",
                "vehicle",
                "driver",
                "planned_trip",
            }
            if any(field in attrs for field in immutable_fields):
                raise serializers.ValidationError("Execuções concluídas não podem ser alteradas.")

        if vehicle and scheduled_departure and scheduled_return and status in [
            TripExecution.Status.PLANNED,
            TripExecution.Status.IN_PROGRESS,
        ]:
            qs = TripExecution.objects.filter(
                vehicle=vehicle,
                status__in=[TripExecution.Status.PLANNED, TripExecution.Status.IN_PROGRESS],
                scheduled_departure__lt=scheduled_return,
                scheduled_return__gt=scheduled_departure,
            )
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("Conflito de agenda: veículo já está em outra viagem.")

        if driver and scheduled_departure and scheduled_return and status in [
            TripExecution.Status.PLANNED,
            TripExecution.Status.IN_PROGRESS,
        ]:
            qs = TripExecution.objects.filter(
                driver=driver,
                status__in=[TripExecution.Status.PLANNED, TripExecution.Status.IN_PROGRESS],
                scheduled_departure__lt=scheduled_return,
                scheduled_return__gt=scheduled_departure,
            )
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("Conflito de agenda: motorista já está em outra viagem.")

            block_qs = DriverAvailabilityBlock.objects.filter(
                driver=driver,
                status=DriverAvailabilityBlock.Status.ACTIVE,
                start_datetime__lt=scheduled_return,
                end_datetime__gt=scheduled_departure,
            )
            if block_qs.exists():
                block = block_qs.first()
                start_fmt = timezone.localtime(block.start_datetime).strftime("%d/%m %H:%M")
                end_fmt = timezone.localtime(block.end_datetime).strftime("%d/%m %H:%M")
                raise serializers.ValidationError(
                    f"Motorista indisponível ({block.get_type_display()}) de {start_fmt} até {end_fmt}."
                )

        if vehicle and manifest_data:
            passengers = manifest_data.get("passengers", [])
            if passengers and len(passengers) > vehicle.max_passengers:
                raise serializers.ValidationError("Quantidade de passageiros excede a capacidade do veículo.")

        return attrs

    def _validate_manifest_conflicts(self, execution, passengers_data):
        if not passengers_data:
            return
        scheduled_departure = execution.scheduled_departure
        scheduled_return = execution.scheduled_return

        for passenger in passengers_data:
            student = passenger.get("student")
            patient = passenger.get("patient")
            companion = passenger.get("companion")
            linked_patient = passenger.get("linked_patient")
            if student and student.municipality_id != execution.municipality_id:
                raise serializers.ValidationError("Aluno precisa pertencer à mesma prefeitura.")
            if patient and patient.municipality_id != execution.municipality_id:
                raise serializers.ValidationError("Paciente precisa pertencer à mesma prefeitura.")
            if companion and companion.municipality_id != execution.municipality_id:
                raise serializers.ValidationError("Acompanhante precisa pertencer à mesma prefeitura.")
            if linked_patient and linked_patient.municipality_id != execution.municipality_id:
                raise serializers.ValidationError("Paciente vinculado precisa pertencer à mesma prefeitura.")
            qs = TripManifestPassenger.objects.filter(
                manifest__trip_execution__scheduled_departure__lt=scheduled_return,
                manifest__trip_execution__scheduled_return__gt=scheduled_departure,
                manifest__trip_execution__status__in=[
                    TripExecution.Status.PLANNED,
                    TripExecution.Status.IN_PROGRESS,
                ],
            )
            if student:
                qs = qs.filter(student=student)
                label = f"Aluno {student.full_name}"
            elif patient:
                qs = qs.filter(patient=patient)
                label = f"Paciente {patient.full_name}"
            elif companion:
                qs = qs.filter(companion=companion)
                label = f"Acompanhante {companion.full_name}"
            elif linked_patient:
                qs = qs.filter(patient=linked_patient)
                label = "Paciente vinculado"
            else:
                continue
            qs = qs.exclude(manifest__trip_execution=execution)
            if qs.exists():
                raise serializers.ValidationError(f"Conflito de agenda: {label} já está em outra viagem.")

    @transaction.atomic
    def create(self, validated_data):
        stops_data = validated_data.pop("stops", [])
        manifest_data = validated_data.pop("manifest", None)
        planned_trip = validated_data.get("planned_trip")
        if planned_trip:
            validated_data.setdefault("module", planned_trip.module)
            if not validated_data.get("planned_capacity"):
                validated_data["planned_capacity"] = planned_trip.planned_capacity
        request_user = getattr(self.context.get("request"), "user", None)
        user = request_user if request_user and getattr(request_user, "is_authenticated", False) else None
        if user and user.role != "SUPERADMIN":
            validated_data["municipality"] = user.municipality
        elif not validated_data.get("municipality"):
            if planned_trip:
                validated_data["municipality"] = planned_trip.municipality
            elif validated_data.get("vehicle"):
                validated_data["municipality"] = validated_data["vehicle"].municipality
        execution = super().create(validated_data)

        for stop in stops_data:
            TripExecutionStop.objects.create(trip_execution=execution, **stop)

        if manifest_data:
            passengers_data = manifest_data.pop("passengers", [])
            manifest = TripManifest.objects.create(trip_execution=execution, **manifest_data)
            if passengers_data:
                for passenger in passengers_data:
                    TripManifestPassenger.objects.create(manifest=manifest, **passenger)
                manifest.total_passengers = len(passengers_data)
                manifest.save(update_fields=["total_passengers"])
            self._validate_manifest_conflicts(execution, passengers_data)
        else:
            TripManifest.objects.get_or_create(trip_execution=execution)
        return execution

    @transaction.atomic
    def update(self, instance, validated_data):
        stops_data = validated_data.pop("stops", None)
        manifest_data = validated_data.pop("manifest", None)
        execution = super().update(instance, validated_data)

        if stops_data is not None:
            execution.stops.all().delete()
            for stop in stops_data:
                TripExecutionStop.objects.create(trip_execution=execution, **stop)

        if manifest_data is not None:
            passengers_data = manifest_data.pop("passengers", None)
            manifest, _ = TripManifest.objects.get_or_create(trip_execution=execution)
            if passengers_data is not None:
                manifest.passengers.all().delete()
                for passenger in passengers_data:
                    TripManifestPassenger.objects.create(manifest=manifest, **passenger)
                manifest.total_passengers = len(passengers_data)
            for attr, value in manifest_data.items():
                setattr(manifest, attr, value)
            manifest.save()
            if passengers_data is not None:
                self._validate_manifest_conflicts(execution, passengers_data)
        return execution
