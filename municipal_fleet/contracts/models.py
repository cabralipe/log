from decimal import Decimal
from django.db import models
from django.utils import timezone


class Contract(models.Model):
    class Type(models.TextChoices):
        LEASE = "LEASE", "Leasing"
        RENTAL = "RENTAL", "Locação"
        SERVICE = "SERVICE", "Serviço"

    class BillingModel(models.TextChoices):
        FIXED = "FIXED", "Valor fixo"
        PER_KM = "PER_KM", "Por KM rodado"
        PER_DAY = "PER_DAY", "Por dia"
        MONTHLY_WITH_KM = "MONTHLY_WITH_KM", "Mensal com franquia de KM"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        INACTIVE = "INACTIVE", "Inativo"
        EXPIRED = "EXPIRED", "Vencido"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="contracts")
    contract_number = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=Type.choices)
    provider_name = models.CharField(max_length=255)
    provider_cnpj = models.CharField(max_length=18, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    billing_model = models.CharField(max_length=30, choices=BillingModel.choices)
    base_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    included_km_per_month = models.PositiveIntegerField(null=True, blank=True)
    extra_km_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "contract_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["municipality", "contract_number"], name="contract_number_unique_per_municipality"
            )
        ]

    def __str__(self):
        return f"{self.contract_number} - {self.provider_name}"

    @property
    def is_expired(self):
        return self.end_date < timezone.localdate()

    def refresh_status(self):
        if self.status == self.Status.EXPIRED:
            return
        if self.end_date and self.end_date < timezone.localdate():
            self.status = self.Status.EXPIRED
            self.save(update_fields=["status"])


class ContractVehicle(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="vehicles")
    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="contract_vehicles")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="contract_links")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    custom_billing_model = models.CharField(
        max_length=30, choices=Contract.BillingModel.choices, null=True, blank=True
    )
    custom_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.contract.contract_number} - {self.vehicle.license_plate}"


class RentalPeriod(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Aberto"
        CLOSED = "CLOSED", "Fechado"
        INVOICED = "INVOICED", "Faturado"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="rental_periods")
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="rental_periods")
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT, related_name="rental_periods", null=True, blank=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField(null=True, blank=True)
    odometer_start = models.PositiveIntegerField(null=True, blank=True)
    odometer_end = models.PositiveIntegerField(null=True, blank=True)
    billed_km = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    billed_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_datetime"]

    def __str__(self):
        return f"{self.contract.contract_number} ({self.start_datetime} - {self.end_datetime or 'aberto'})"
