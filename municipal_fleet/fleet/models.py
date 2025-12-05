from django.db import models


class Vehicle(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Disponivel"
        IN_USE = "IN_USE", "Em uso"
        MAINTENANCE = "MAINTENANCE", "Manutencao"
        INACTIVE = "INACTIVE", "Inativo"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="vehicles")
    license_plate = models.CharField(max_length=10)
    model = models.CharField(max_length=100)
    brand = models.CharField(max_length=100)
    year = models.PositiveIntegerField()
    max_passengers = models.PositiveIntegerField()
    odometer_current = models.PositiveIntegerField(default=0)
    odometer_initial = models.PositiveIntegerField(default=0)
    odometer_monthly_limit = models.PositiveIntegerField(default=0)
    last_service_date = models.DateField(null=True, blank=True)
    next_service_date = models.DateField(null=True, blank=True)
    last_oil_change_date = models.DateField(null=True, blank=True)
    next_oil_change_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("municipality", "license_plate")
        ordering = ["license_plate"]

    def __str__(self) -> str:
        return f"{self.license_plate} - {self.model}"


class VehicleMaintenance(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="maintenances")
    description = models.TextField()
    date = models.DateField()
    mileage = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.vehicle.license_plate} - {self.description}"
