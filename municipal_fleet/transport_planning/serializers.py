from datetime import datetime, timedelta
from django.db import transaction
from django.utils import timezone
from django.db import models
from rest_framework import serializers
from transport_planning.models import (
    Person,
    TransportService,
    Route,
    RouteStop,
    ServiceUnit,
    RouteUnit,
    EligibilityPolicy,
    ServiceApplication,
    Assignment,
)
from trips.serializers import TripSerializer
from trips.models import Trip
from fleet.models import Vehicle
from drivers.models import Driver
from contracts.models import Contract
from transport_planning import services as planning_services
from tenants.utils import resolve_municipality


ALLOWED_PERSON_CATEGORIES = {"STUDENT", "PCD", "ELDERLY", "PATIENT", "CITIZEN", "OTHER"}


class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at"]

    def validate_categories(self, value):
        if not value:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("categories deve ser uma lista.")
        invalid = [c for c in value if c not in ALLOWED_PERSON_CATEGORIES]
        if invalid:
            raise serializers.ValidationError(f"Categorias inválidas: {', '.join(invalid)}")
        return value

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", Person.Status.ACTIVE))
        cpf = attrs.get("cpf", getattr(self.instance, "cpf", None))
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))
        if status == Person.Status.ACTIVE and cpf and municipality:
            qs = Person.objects.filter(municipality=municipality, cpf=cpf, status=Person.Status.ACTIVE)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("Já existe um beneficiário ativo com este CPF nesta prefeitura.")
        return attrs

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        return super().create(validated_data)


class TransportServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportService
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "municipality"]

    def validate(self, attrs):
        form_template = attrs.get("form_template", getattr(self.instance, "form_template", None))
        if form_template and not form_template.require_cpf:
            raise serializers.ValidationError("Formulário vinculado precisa exigir CPF.")
        return attrs

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        return super().create(validated_data)


class ServiceUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceUnit
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at"]

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        return super().create(validated_data)


class RouteStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteStop
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at"]

    def create(self, validated_data):
        route = validated_data["route"]
        validated_data["municipality"] = route.municipality
        return super().create(validated_data)

    def validate(self, attrs):
        route = attrs.get("route", getattr(self.instance, "route", None))
        municipality = getattr(route, "municipality", None)
        if route and municipality:
            attrs["municipality"] = municipality
        return attrs


class RouteSerializer(serializers.ModelSerializer):
    stops = RouteStopSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at"]

    def validate(self, attrs):
        service = attrs.get("transport_service", getattr(self.instance, "transport_service", None))
        contract = attrs.get("contract", getattr(self.instance, "contract", None))
        municipality = (
            attrs.get("municipality")
            or getattr(service, "municipality", None)
            or getattr(self.instance, "municipality", None)
        )
        start = attrs.get("time_window_start", getattr(self.instance, "time_window_start", None))
        end = attrs.get("time_window_end", getattr(self.instance, "time_window_end", None))

        if service and municipality and service.municipality_id != getattr(municipality, "id", municipality):
            raise serializers.ValidationError("Serviço precisa ser da mesma prefeitura.")
        if contract:
            contract.refresh_status()
            if contract.status != Contract.Status.ACTIVE:
                raise serializers.ValidationError("Contrato vinculado precisa estar ativo.")
            if municipality and contract.municipality_id != getattr(municipality, "id", municipality):
                raise serializers.ValidationError("Contrato precisa ser da mesma prefeitura.")
        if start and end and end <= start:
            raise serializers.ValidationError("Janela de horário inválida: fim deve ser após início.")
        return attrs

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        return super().create(validated_data)


class RouteUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteUnit
        fields = "__all__"
        read_only_fields = ["id", "municipality"]

    def create(self, validated_data):
        validated_data["municipality"] = validated_data["route"].municipality
        return super().create(validated_data)

    def validate(self, attrs):
        route = attrs.get("route", getattr(self.instance, "route", None))
        unit = attrs.get("service_unit", getattr(self.instance, "service_unit", None))
        if route and unit and route.municipality_id != unit.municipality_id:
            raise serializers.ValidationError("Unidade e rota precisam ser da mesma prefeitura.")
        return attrs


class EligibilityPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = EligibilityPolicy
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at"]

    def validate(self, attrs):
        service = attrs.get("transport_service", getattr(self.instance, "transport_service", None))
        route = attrs.get("route", getattr(self.instance, "route", None))
        municipality = (
            attrs.get("municipality")
            or getattr(service, "municipality", None)
            or getattr(self.instance, "municipality", None)
        )
        if service and municipality and service.municipality_id != getattr(municipality, "id", municipality):
            raise serializers.ValidationError("Serviço precisa ser da mesma prefeitura.")
        if route and municipality and route.municipality_id != getattr(municipality, "id", municipality):
            raise serializers.ValidationError("Rota precisa ser da mesma prefeitura.")
        if route and service and route.transport_service_id != service.id:
            raise serializers.ValidationError("Rota informada não pertence ao serviço.")
        return attrs

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        return super().create(validated_data)


class ServiceApplicationSerializer(serializers.ModelSerializer):
    person_detail = PersonSerializer(source="person", read_only=True)

    class Meta:
        model = ServiceApplication
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at", "status"]

    def validate(self, attrs):
        person = attrs.get("person", getattr(self.instance, "person", None))
        service = attrs.get("transport_service", getattr(self.instance, "transport_service", None))
        route = attrs.get("route", getattr(self.instance, "route", None))
        submission = attrs.get("form_submission", getattr(self.instance, "form_submission", None))
        municipality = attrs.get("municipality", getattr(self.instance, "municipality", None))
        if service and route and route.transport_service_id != service.id:
            raise serializers.ValidationError("Rota não pertence ao serviço informado.")
        if person and municipality and person.municipality_id != getattr(municipality, "id", municipality):
            raise serializers.ValidationError("Beneficiário precisa ser da mesma prefeitura.")
        if route and municipality and route.municipality_id != getattr(municipality, "id", municipality):
            raise serializers.ValidationError("Rota precisa ser da mesma prefeitura.")
        if submission and service and service.form_template_id and submission.form_template_id != service.form_template_id:
            raise serializers.ValidationError("Submissão não está vinculada ao formulário do serviço.")
        return attrs

    def _evaluate_policy(self, application: ServiceApplication):
        return planning_services.evaluate_eligibility(application.transport_service, application.route)

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        application = ServiceApplication(**validated_data)
        status, notes = self._evaluate_policy(application)
        application.status = status
        if notes:
            application.status_notes = notes
        application.save()
        return application

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class AssignmentSerializer(serializers.ModelSerializer):
    route_detail = RouteSerializer(source="route", read_only=True)
    vehicle_detail = serializers.SerializerMethodField()
    driver_detail = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = "__all__"
        read_only_fields = ["id", "municipality", "created_at", "updated_at", "generated_trip"]

    def get_vehicle_detail(self, obj) -> dict:
        vehicle = obj.vehicle
        return {"id": vehicle.id, "license_plate": vehicle.license_plate, "capacity": vehicle.max_passengers}

    def get_driver_detail(self, obj) -> dict:
        driver = obj.driver
        return {"id": driver.id, "name": driver.name}

    def _build_period(self, route: Route, date_value):
        start = None
        end = None
        tz = timezone.get_current_timezone()
        if route.time_window_start:
            start = timezone.make_aware(datetime.combine(date_value, route.time_window_start), timezone=tz)
        if route.time_window_end:
            end = timezone.make_aware(datetime.combine(date_value, route.time_window_end), timezone=tz)
        if not end and start and route.estimated_duration_minutes:
            end = start + timedelta(minutes=route.estimated_duration_minutes)
        return start, end

    def _check_conflicts(self, attrs, instance=None):
        route = attrs.get("route", getattr(instance, "route", None))
        vehicle = attrs.get("vehicle", getattr(instance, "vehicle", None))
        driver = attrs.get("driver", getattr(instance, "driver", None))
        status = attrs.get("status", getattr(instance, "status", Assignment.Status.DRAFT))
        date_value = attrs.get("date", getattr(instance, "date", None))
        start, end = self._build_period(route, date_value)
        if not (start and end):
            return
        conflicting_assignments = Assignment.objects.filter(
            date=date_value,
            status__in=[Assignment.Status.DRAFT, Assignment.Status.CONFIRMED],
            route__time_window_start__isnull=False,
            route__time_window_end__isnull=False,
        )
        if instance:
            conflicting_assignments = conflicting_assignments.exclude(id=instance.id)
        if vehicle:
            conflicts_vehicle = conflicting_assignments.filter(vehicle=vehicle)
            if conflicts_vehicle.filter(route__time_window_start__lt=end.time(), route__time_window_end__gt=start.time()).exists():
                raise serializers.ValidationError("Conflito de agenda: veículo já alocado no horário.")
        if driver:
            conflicts_driver = conflicting_assignments.filter(driver=driver)
            if conflicts_driver.filter(route__time_window_start__lt=end.time(), route__time_window_end__gt=start.time()).exists():
                raise serializers.ValidationError("Conflito de agenda: motorista já alocado no horário.")
        if status == Assignment.Status.CONFIRMED and vehicle:
            trip_conflicts = Trip.objects.filter(
                vehicle=vehicle,
                status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
                departure_datetime__lt=end,
                return_datetime_expected__gt=start,
            )
            if trip_conflicts.exists():
                raise serializers.ValidationError("Veículo possui viagem conflitante.")

    def validate(self, attrs):
        route = attrs.get("route", getattr(self.instance, "route", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        driver = attrs.get("driver", getattr(self.instance, "driver", None))
        status_value = attrs.get("status", getattr(self.instance, "status", Assignment.Status.DRAFT))
        date_value = attrs.get("date", getattr(self.instance, "date", None))

        if route and vehicle and route.municipality_id != vehicle.municipality_id:
            raise serializers.ValidationError("Veículo precisa ser da mesma prefeitura da rota.")
        if route and driver and route.municipality_id != driver.municipality_id:
            raise serializers.ValidationError("Motorista precisa ser da mesma prefeitura da rota.")
        if vehicle and vehicle.status == Vehicle.Status.MAINTENANCE:
            raise serializers.ValidationError("Veículo em manutenção não pode ser escalado.")
        if route and vehicle and route.planned_capacity and vehicle.max_passengers < route.planned_capacity:
            raise serializers.ValidationError("Capacidade do veículo é inferior à planejada para a rota.")
        if driver and driver.status != Driver.Status.ACTIVE:
            raise serializers.ValidationError("Motorista precisa estar ativo.")
        if route and route.contract:
            route.contract.refresh_status()
            if route.contract.status != Contract.Status.ACTIVE:
                raise serializers.ValidationError("Contrato da rota não está ativo.")

        if status_value == Assignment.Status.CONFIRMED:
            if not route.time_window_start:
                raise serializers.ValidationError("Rota precisa ter horário de início para confirmar.")
            start, end = self._build_period(route, date_value)
            if not end:
                raise serializers.ValidationError("Informe hora final ou duração estimada para confirmar.")
        self._check_conflicts(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        municipality = resolve_municipality(self.context.get("request"), validated_data.get("municipality"))
        if not municipality:
            raise serializers.ValidationError("Prefeitura é obrigatória.")
        validated_data["municipality"] = municipality
        assignment = super().create(validated_data)
        self._ensure_trip(assignment)
        return assignment

    @transaction.atomic
    def update(self, instance, validated_data):
        assignment = super().update(instance, validated_data)
        self._ensure_trip(assignment)
        return assignment

    def _ensure_trip(self, assignment: Assignment):
        request = self.context.get("request")
        if assignment.status != Assignment.Status.CONFIRMED:
            return
        if assignment.generated_trip:
            return
        route = assignment.route
        vehicle = assignment.vehicle
        driver = assignment.driver
        start, end = assignment.estimated_period()
        if not start or not end:
            return
        passengers = route.planned_capacity or 0
        stops = list(route.stops.order_by("order").values_list("description", flat=True))
        stops_description = " -> ".join(stops) if stops else route.name
        origin = stops[0] if stops else route.name
        destination = stops[-1] if stops else route.name
        trip_payload = {
            "vehicle": vehicle.id,
            "driver": driver.id,
            "municipality": assignment.municipality.id,
            "contract": route.contract.id if route.contract else None,
            "origin": origin,
            "destination": destination,
            "departure_datetime": start,
            "return_datetime_expected": end,
            "odometer_start": vehicle.odometer_current or 0,
            "passengers_count": passengers,
            "stops_description": stops_description,
            "status": Trip.Status.PLANNED,
            "category": Trip.Category.PASSENGER,
        }
        serializer = TripSerializer(data=trip_payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        trip = serializer.save()
        assignment.generated_trip = trip
        assignment.save(update_fields=["generated_trip"])
