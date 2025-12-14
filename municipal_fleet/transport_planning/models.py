from datetime import datetime, timedelta
from django.db import models
from django.utils import timezone


class Person(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        INACTIVE = "INACTIVE", "Inativo"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="persons")
    full_name = models.CharField(max_length=255)
    cpf = models.CharField(max_length=20, db_index=True)
    date_of_birth = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    district = models.CharField(max_length=100, blank=True)
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    categories = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["municipality", "cpf"],
                condition=models.Q(status="ACTIVE"),
                name="unique_active_person_per_municipality",
            )
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.cpf})"


class TransportService(models.Model):
    class ServiceType(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Recorrente"
        ON_DEMAND = "ON_DEMAND", "Sob demanda"
        MIXED = "MIXED", "Híbrido"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="transport_services")
    name = models.CharField(max_length=255)
    service_type = models.CharField(max_length=20, choices=ServiceType.choices)
    description = models.TextField(blank=True)
    requires_authorization = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    form_template = models.ForeignKey(
        "forms.FormTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transport_services",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ServiceUnit(models.Model):
    class UnitType(models.TextChoices):
        SCHOOL = "SCHOOL", "Escola"
        HEALTH = "HEALTH", "Saúde"
        SOCIAL_ASSISTANCE = "SOCIAL_ASSISTANCE", "Assistência Social"
        OTHER = "OTHER", "Outro"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="service_units")
    name = models.CharField(max_length=255)
    unit_type = models.CharField(max_length=32, choices=UnitType.choices)
    address = models.CharField(max_length=255, blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("municipality", "name")

    def __str__(self):
        return self.name


class Route(models.Model):
    class RouteType(models.TextChoices):
        URBAN = "URBAN", "Urbana"
        RURAL = "RURAL", "Rural"
        SPECIAL = "SPECIAL", "Especial"
        EVENT = "EVENT", "Evento"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="routes")
    transport_service = models.ForeignKey(TransportService, on_delete=models.CASCADE, related_name="routes")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    route_type = models.CharField(max_length=20, choices=RouteType.choices, default=RouteType.URBAN)
    days_of_week = models.JSONField(default=list, blank=True)
    time_window_start = models.TimeField(null=True, blank=True)
    time_window_end = models.TimeField(null=True, blank=True)
    estimated_duration_minutes = models.PositiveIntegerField(default=0)
    planned_capacity = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    preferred_vehicles = models.ManyToManyField("fleet.Vehicle", blank=True, related_name="preferred_routes")
    preferred_drivers = models.ManyToManyField("drivers.Driver", blank=True, related_name="preferred_routes")
    contract = models.ForeignKey("contracts.Contract", on_delete=models.SET_NULL, null=True, blank=True, related_name="routes")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["municipality", "code"], name="route_code_unique_per_municipality"
            )
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class RouteStop(models.Model):
    class StopType(models.TextChoices):
        PICKUP = "PICKUP", "Embarque"
        DROPOFF = "DROPOFF", "Desembarque"
        WAYPOINT = "WAYPOINT", "Passagem"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="route_stops")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="stops")
    order = models.PositiveIntegerField()
    description = models.CharField(max_length=255)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    scheduled_time = models.TimeField(null=True, blank=True)
    stop_type = models.CharField(max_length=20, choices=StopType.choices, default=StopType.WAYPOINT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("route", "order")

    def __str__(self):
        return f"{self.route.code}#{self.order} - {self.description}"


class RouteUnit(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="route_units")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="route_units")
    service_unit = models.ForeignKey(ServiceUnit, on_delete=models.CASCADE, related_name="route_units")

    class Meta:
        unique_together = ("route", "service_unit")


class EligibilityPolicy(models.Model):
    class DecisionMode(models.TextChoices):
        AUTO_APPROVE = "AUTO_APPROVE", "Aprovar automaticamente"
        AUTO_DENY = "AUTO_DENY", "Negar automaticamente"
        AUTO_THEN_REVIEW = "AUTO_THEN_REVIEW", "Auto e revisar"
        MANUAL_REVIEW_ONLY = "MANUAL_REVIEW_ONLY", "Somente revisão manual"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="eligibility_policies")
    transport_service = models.ForeignKey(TransportService, on_delete=models.CASCADE, related_name="eligibility_policies")
    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True, blank=True, related_name="eligibility_policies")
    name = models.CharField(max_length=255)
    rules_json = models.JSONField(default=dict, blank=True)
    decision_mode = models.CharField(max_length=30, choices=DecisionMode.choices, default=DecisionMode.MANUAL_REVIEW_ONLY)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ServiceApplication(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        APPROVED = "APPROVED", "Aprovado"
        REJECTED = "REJECTED", "Rejeitado"
        NEEDS_CORRECTION = "NEEDS_CORRECTION", "Correção Necessária"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="service_applications")
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="applications")
    transport_service = models.ForeignKey(TransportService, on_delete=models.CASCADE, related_name="applications")
    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True, blank=True, related_name="applications")
    form_submission = models.ForeignKey("forms.FormSubmission", on_delete=models.CASCADE, related_name="service_applications")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    status_notes = models.TextField(blank=True)
    correction_deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transport_service.name} - {self.person.cpf}"


class Assignment(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Rascunho"
        CONFIRMED = "CONFIRMED", "Confirmado"
        CANCELLED = "CANCELLED", "Cancelado"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="assignments")
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="assignments")
    date = models.DateField()
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="assignments")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="assignments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    generated_trip = models.ForeignKey("trips.Trip", on_delete=models.SET_NULL, null=True, blank=True, related_name="assignments")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        unique_together = ("route", "date", "vehicle", "driver")

    def __str__(self):
        return f"{self.route.code} - {self.date}"

    def estimated_period(self):
        start = None
        end = None
        if self.route.time_window_start:
            start = timezone.make_aware(
                datetime.combine(self.date, self.route.time_window_start),
                timezone=timezone.get_current_timezone(),
            )
        if self.route.time_window_end:
            end = timezone.make_aware(
                datetime.combine(self.date, self.route.time_window_end),
                timezone=timezone.get_current_timezone(),
            )
        if not end and start and self.route.estimated_duration_minutes:
            end = start + timedelta(minutes=self.route.estimated_duration_minutes)
        return start, end
