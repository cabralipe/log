from decimal import Decimal
from django.db import models
from django.utils import timezone


class Vehicle(models.Model):
    class OwnershipType(models.TextChoices):
        OWNED = "OWNED", "Próprio"
        LEASED = "LEASED", "Leasing"
        RENTED = "RENTED", "Alugado"
        THIRD_PARTY = "THIRD_PARTY", "Terceiro"

    class Category(models.TextChoices):
        PASSENGER = "PASSENGER", "Transporte de passageiros"
        CARGO = "CARGO", "Carga"
        SERVICE = "SERVICE", "Serviço"
        HOSPITAL = "HOSPITAL", "Hospitalar"

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
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.PASSENGER)
    current_contract = models.ForeignKey(
        "contracts.Contract",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vehicles_in_use",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    image = models.ImageField(upload_to="vehicle_images/", null=True, blank=True)
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


class FuelProduct(models.Model):
    class Unit(models.TextChoices):
        LITER = "LITER", "Litro"
        UNIT = "UNIT", "Unidade"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_products")
    name = models.CharField(max_length=100)
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.LITER)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("municipality", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.municipality})"


class FuelStationLimit(models.Model):
    class Period(models.TextChoices):
        DAILY = "DAILY", "Diario"
        WEEKLY = "WEEKLY", "Semanal"
        MONTHLY = "MONTHLY", "Mensal"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_station_limits")
    fuel_station = models.ForeignKey(FuelStation, on_delete=models.CASCADE, related_name="limits")
    contract = models.ForeignKey(
        "contracts.Contract", on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_station_limits"
    )
    product = models.ForeignKey(FuelProduct, on_delete=models.PROTECT, related_name="station_limits")
    period = models.CharField(max_length=10, choices=Period.choices)
    max_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["fuel_station", "contract", "product", "period"],
                name="unique_station_limit_per_period",
            )
        ]

    def __str__(self):
        return f"{self.fuel_station} - {self.product} ({self.period})"


class FuelRule(models.Model):
    class Scope(models.TextChoices):
        MUNICIPALITY = "MUNICIPALITY", "Municipio"
        VEHICLE = "VEHICLE", "Veiculo"
        CONTRACT = "CONTRACT", "Contrato"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_rules")
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.MUNICIPALITY)
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, null=True, blank=True, related_name="fuel_rules"
    )
    contract = models.ForeignKey(
        "contracts.Contract", on_delete=models.CASCADE, null=True, blank=True, related_name="fuel_rules"
    )
    allowed_weekdays = models.JSONField(default=list, blank=True)
    allowed_start_time = models.TimeField(null=True, blank=True)
    allowed_end_time = models.TimeField(null=True, blank=True)
    min_interval_minutes = models.PositiveIntegerField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Regra abastecimento ({self.scope})"


class FuelAlert(models.Model):
    class Severity(models.TextChoices):
        LOW = "LOW", "Baixa"
        MEDIUM = "MEDIUM", "Media"
        HIGH = "HIGH", "Alta"
        CRITICAL = "CRITICAL", "Critica"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_alerts")
    alert_type = models.CharField(max_length=50)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    message = models.TextField()
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.PositiveIntegerField(null=True, blank=True)
    fuel_log = models.ForeignKey(
        "fleet.FuelLog", on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts"
    )
    trip = models.ForeignKey(
        "trips.Trip", on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_alerts"
    )
    service_order = models.ForeignKey(
        "trips.ServiceOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_alerts"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.alert_type} ({self.severity})"


class FuelInvoice(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_invoices")
    fuel_station = models.ForeignKey(FuelStation, on_delete=models.PROTECT, related_name="invoices")
    period_start = models.DateField()
    period_end = models.DateField()
    total_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    uploaded_file = models.FileField(upload_to="fuel_invoices/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_start"]

    def __str__(self):
        return f"Fatura {self.fuel_station} ({self.period_start} - {self.period_end})"


class FuelInvoiceItem(models.Model):
    invoice = models.ForeignKey(FuelInvoice, on_delete=models.CASCADE, related_name="items")
    ticket_number = models.CharField(max_length=100, blank=True)
    occurred_at = models.DateTimeField(null=True, blank=True)
    product = models.ForeignKey(FuelProduct, on_delete=models.PROTECT, related_name="invoice_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    matched_fuel_log = models.ForeignKey(
        "fleet.FuelLog", on_delete=models.SET_NULL, null=True, blank=True, related_name="invoice_items"
    )

    class Meta:
        ordering = ["-occurred_at", "-id"]

    def __str__(self):
        return f"Item fatura {self.invoice_id} - {self.ticket_number or self.id}"


class FuelLog(models.Model):
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="fuel_logs")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="fuel_logs")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="fuel_logs")
    filled_at = models.DateField()
    liters = models.DecimalField(max_digits=8, decimal_places=2)
    price_per_liter = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    fuel_station = models.CharField(max_length=255)
    fuel_station_ref = models.ForeignKey(FuelStation, null=True, blank=True, on_delete=models.PROTECT, related_name="fuel_logs")
    product = models.ForeignKey(FuelProduct, null=True, blank=True, on_delete=models.PROTECT, related_name="fuel_logs")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    odometer = models.PositiveIntegerField(null=True, blank=True)
    ticket_number = models.CharField(max_length=100, blank=True)
    ticket_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    service_order = models.ForeignKey(
        "trips.ServiceOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_logs"
    )
    trip = models.ForeignKey(
        "trips.Trip", on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_logs"
    )
    receipt_image = models.FileField(upload_to="fuel_receipts/", null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-filled_at", "-created_at"]

    def __str__(self):
        return f"{self.vehicle.license_plate} - {self.liters} L em {self.fuel_station}"

    def save(self, *args, **kwargs):
        if self.price_per_liter is not None and self.liters is not None:
            self.total_cost = Decimal(self.price_per_liter) * Decimal(self.liters)
        super().save(*args, **kwargs)


class VehicleInspection(models.Model):
    class ConditionStatus(models.TextChoices):
        OK = "OK", "Aprovado"
        ATTENTION = "ATTENTION", "Atenção"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="vehicle_inspections")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="inspections")
    driver = models.ForeignKey("drivers.Driver", on_delete=models.PROTECT, related_name="inspections")
    inspection_date = models.DateField()
    inspected_at = models.DateTimeField(default=timezone.now)
    odometer = models.PositiveIntegerField(null=True, blank=True)
    checklist_items = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    condition_status = models.CharField(max_length=20, choices=ConditionStatus.choices, default=ConditionStatus.OK)
    signature_name = models.CharField(max_length=255, blank=True)
    signature_image = models.FileField(upload_to="inspection_signatures/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-inspection_date", "-inspected_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["vehicle", "inspection_date"], name="unique_vehicle_inspection_per_day"),
        ]

    def __str__(self):
        return f"{self.vehicle.license_plate} - {self.inspection_date}"

    def save(self, *args, **kwargs):
        if not self.inspection_date:
            self.inspection_date = timezone.localdate(self.inspected_at)
        super().save(*args, **kwargs)


class VehicleInspectionDamagePhoto(models.Model):
    inspection = models.ForeignKey(
        VehicleInspection, on_delete=models.CASCADE, related_name="damage_photos"
    )
    image = models.FileField(upload_to="inspection_damages/")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Avaria {self.inspection_id}"
