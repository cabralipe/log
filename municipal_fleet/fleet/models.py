from django.db import models


class Vehicle(models.Model):
    class OwnershipType(models.TextChoices):
        OWNED = "OWNED", "Próprio"
        LEASED = "LEASED", "Leasing"
        RENTED = "RENTED", "Alugado"
        THIRD_PARTY = "THIRD_PARTY", "Terceiro"

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
    ownership_type = models.CharField(max_length=20, choices=OwnershipType.choices, default=OwnershipType.OWNED)
    current_contract = models.ForeignKey(
        "contracts.Contract",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vehicles_in_use",
    )
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


class FuelStation(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_stations")
    name = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=18, blank=True)
    address = models.CharField(max_length=255, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("municipality", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.municipality})"


class FuelLog(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_logs")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="fuel_logs")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="fuel_logs")
    filled_at = models.DateField()
    liters = models.DecimalField(max_digits=8, decimal_places=2)
    fuel_station = models.CharField(max_length=255)
    fuel_station_ref = models.ForeignKey(FuelStation, null=True, blank=True, on_delete=models.PROTECT, related_name="fuel_logs")
    receipt_image = models.FileField(upload_to="fuel_receipts/", null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-filled_at", "-created_at"]

    def __str__(self):
        return f"{self.vehicle.license_plate} - {self.liters} L em {self.fuel_station}"
