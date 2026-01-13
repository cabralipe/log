from django.db import models
from django.utils import timezone


class ServiceOrder(models.Model):
    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planejada"
        IN_PROGRESS = "IN_PROGRESS", "Em andamento"
        COMPLETED = "COMPLETED", "Concluida"
        CANCELLED = "CANCELLED", "Cancelada"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="external_service_orders"
    )
    external_id = models.CharField(max_length=100)
    service_type = models.CharField(max_length=255, blank=True)
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="external_service_orders")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="external_service_orders")
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    executed_start = models.DateTimeField(null=True, blank=True)
    executed_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["municipality", "external_id"], name="unique_service_order_external_id")
        ]

    def __str__(self) -> str:
        return f"OS {self.external_id} - {self.vehicle.license_plate}"


class Trip(models.Model):
    class Category(models.TextChoices):
        PASSENGER = "PASSENGER", "Passageiro"
        OBJECT = "OBJECT", "Objeto"
        MIXED = "MIXED", "Passageiro e Objeto"

    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planejada"
        IN_PROGRESS = "IN_PROGRESS", "Em andamento"
        COMPLETED = "COMPLETED", "Concluida"
        CANCELLED = "CANCELLED", "Cancelada"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="trips")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="trips")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="trips")
    service_order = models.ForeignKey(
        "trips.ServiceOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="trips"
    )
    contract = models.ForeignKey(
        "contracts.Contract", on_delete=models.SET_NULL, null=True, blank=True, related_name="trips"
    )
    rental_period = models.ForeignKey(
        "contracts.RentalPeriod", on_delete=models.SET_NULL, null=True, blank=True, related_name="trips"
    )
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    departure_datetime = models.DateTimeField()
    return_datetime_expected = models.DateTimeField()
    return_datetime_actual = models.DateTimeField(null=True, blank=True)
    odometer_start = models.PositiveIntegerField()
    odometer_end = models.PositiveIntegerField(null=True, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.PASSENGER)
    passengers_count = models.PositiveIntegerField(default=0)
    passengers_details = models.JSONField(default=list, blank=True)
    cargo_description = models.CharField(max_length=255, blank=True)
    cargo_size = models.CharField(max_length=100, blank=True)
    cargo_quantity = models.PositiveIntegerField(default=0)
    cargo_purpose = models.CharField(max_length=255, blank=True)
    stops_description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-departure_datetime"]

    def __str__(self):
        return f"{self.origin} -> {self.destination} ({self.departure_datetime.date()})"


class TripGpsPing(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="gps_pings")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.CASCADE, related_name="gps_pings")
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)
    recorded_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at", "-id"]
        indexes = [
            models.Index(fields=["trip", "recorded_at"]),
            models.Index(fields=["driver", "recorded_at"]),
        ]

    def __str__(self):
        return f"GPS {self.driver_id} @ {self.recorded_at:%Y-%m-%d %H:%M:%S}"


class TripIncident(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="trip_incidents")
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="incidents")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.CASCADE, related_name="trip_incidents")
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ocorrência na viagem #{self.trip_id}"


class MonthlyOdometer(models.Model):
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.CASCADE, related_name="odometer_monthly")
    year = models.IntegerField()
    month = models.IntegerField()
    kilometers = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("vehicle", "year", "month")
        ordering = ["-year", "-month"]

    def add_distance(self, distance: int):
        self.kilometers += distance
        self.save(update_fields=["kilometers"])

    @property
    def period(self):
        return f"{self.month:02d}/{self.year}"


class FreeTrip(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Em aberto"
        CLOSED = "CLOSED", "Encerrada"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="free_trips")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="free_trips")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="free_trips")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    odometer_start = models.PositiveIntegerField()
    odometer_start_photo = models.FileField(upload_to="free_trips/start/", null=True, blank=True)
    odometer_end = models.PositiveIntegerField(null=True, blank=True)
    odometer_end_photo = models.FileField(upload_to="free_trips/end/", null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Viagem livre {self.driver} - {self.vehicle}"

    @property
    def distance(self):
        if self.odometer_end is None:
            return None
        return self.odometer_end - self.odometer_start


class FreeTripIncident(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="free_trip_incidents")
    free_trip = models.ForeignKey(FreeTrip, on_delete=models.CASCADE, related_name="incidents")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.CASCADE, related_name="free_trip_incidents")
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ocorrência viagem livre #{self.free_trip_id}"


class PlannedTrip(models.Model):
    class Recurrence(models.TextChoices):
        NONE = "NONE", "Única"
        WEEKLY = "WEEKLY", "Semanal"
        MONTHLY = "MONTHLY", "Mensal"
        QUARTERLY = "QUARTERLY", "Trimestral"
        YEARLY = "YEARLY", "Anual"

    class Module(models.TextChoices):
        EDUCATION = "EDUCATION", "Educação"
        HEALTH = "HEALTH", "Saúde"
        OTHER = "OTHER", "Outro"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="planned_trips")
    title = models.CharField(max_length=255)
    module = models.CharField(max_length=20, choices=Module.choices, default=Module.OTHER)
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, null=True, blank=True, related_name="planned_trips")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, null=True, blank=True, related_name="planned_trips")
    recurrence = models.CharField(max_length=20, choices=Recurrence.choices, default=Recurrence.NONE)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    departure_time = models.TimeField()
    return_time_expected = models.TimeField()
    planned_capacity = models.PositiveIntegerField(default=0)
    optimize_route = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self):
        return self.title


class PlannedTripStop(models.Model):
    planned_trip = models.ForeignKey(PlannedTrip, on_delete=models.CASCADE, related_name="stops")
    destination = models.ForeignKey("destinations.Destination", on_delete=models.PROTECT, related_name="planned_trip_stops")
    order = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("planned_trip", "order")

    def __str__(self):
        return f"{self.planned_trip_id} #{self.order}"


class PlannedTripPassenger(models.Model):
    class PassengerType(models.TextChoices):
        STUDENT = "STUDENT", "Aluno"
        PATIENT = "PATIENT", "Paciente"
        COMPANION = "COMPANION", "Acompanhante"

    planned_trip = models.ForeignKey(PlannedTrip, on_delete=models.CASCADE, related_name="passengers")
    passenger_type = models.CharField(max_length=20, choices=PassengerType.choices)
    student = models.ForeignKey(
        "students.Student", on_delete=models.SET_NULL, null=True, blank=True, related_name="planned_trip_passengers"
    )
    patient = models.ForeignKey(
        "health.Patient", on_delete=models.SET_NULL, null=True, blank=True, related_name="planned_trip_passengers"
    )
    companion = models.ForeignKey(
        "health.Companion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planned_trip_passengers",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.planned_trip_id} - {self.passenger_type}"


class TripExecution(models.Model):
    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planejada"
        IN_PROGRESS = "IN_PROGRESS", "Em andamento"
        COMPLETED = "COMPLETED", "Concluída"
        CANCELLED = "CANCELLED", "Cancelada"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="trip_executions")
    planned_trip = models.ForeignKey(
        PlannedTrip, on_delete=models.SET_NULL, null=True, blank=True, related_name="executions"
    )
    module = models.CharField(max_length=20, choices=PlannedTrip.Module.choices, default=PlannedTrip.Module.OTHER)
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="trip_executions")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="trip_executions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    scheduled_departure = models.DateTimeField()
    scheduled_return = models.DateTimeField()
    actual_departure = models.DateTimeField(null=True, blank=True)
    actual_return = models.DateTimeField(null=True, blank=True)
    planned_capacity = models.PositiveIntegerField(default=0)
    is_manual_override = models.BooleanField(default=False)
    route_distance_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    route_duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    route_geometry = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_departure", "-created_at"]

    def __str__(self):
        return f"Execução {self.id} ({self.scheduled_departure:%d/%m/%Y})"


class TripExecutionStop(models.Model):
    trip_execution = models.ForeignKey(TripExecution, on_delete=models.CASCADE, related_name="stops")
    destination = models.ForeignKey(
        "destinations.Destination", on_delete=models.PROTECT, related_name="trip_execution_stops"
    )
    order = models.PositiveIntegerField(default=0)
    arrival_time = models.DateTimeField(null=True, blank=True)
    departure_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("trip_execution", "order")

    def __str__(self):
        return f"{self.trip_execution_id} #{self.order}"


class TripManifest(models.Model):
    trip_execution = models.OneToOneField(TripExecution, on_delete=models.CASCADE, related_name="manifest")
    total_passengers = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Manifesto #{self.trip_execution_id}"


class TripManifestPassenger(models.Model):
    class PassengerType(models.TextChoices):
        STUDENT = "STUDENT", "Aluno"
        PATIENT = "PATIENT", "Paciente"
        COMPANION = "COMPANION", "Acompanhante"

    manifest = models.ForeignKey(TripManifest, on_delete=models.CASCADE, related_name="passengers")
    passenger_type = models.CharField(max_length=20, choices=PassengerType.choices)
    student = models.ForeignKey(
        "students.Student", on_delete=models.SET_NULL, null=True, blank=True, related_name="trip_manifest_entries"
    )
    patient = models.ForeignKey(
        "health.Patient", on_delete=models.SET_NULL, null=True, blank=True, related_name="trip_manifest_entries"
    )
    companion = models.ForeignKey(
        "health.Companion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="trip_manifest_entries",
    )
    linked_patient = models.ForeignKey(
        "health.Patient", on_delete=models.SET_NULL, null=True, blank=True, related_name="companion_manifest_links"
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.manifest_id} - {self.passenger_type}"
