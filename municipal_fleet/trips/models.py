from django.db import models
from django.utils import timezone


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
