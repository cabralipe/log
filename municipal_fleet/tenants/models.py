from django.db import models


class Municipality(models.Model):
    class FuelContractPeriod(models.TextChoices):
        WEEKLY = "WEEKLY", "Semanal"
        MONTHLY = "MONTHLY", "Mensal"
        QUARTERLY = "QUARTERLY", "Trimestral"

    name = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=32, unique=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    phone = models.CharField(max_length=20)
    fuel_contract_limit = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    fuel_contract_period = models.CharField(max_length=12, choices=FuelContractPeriod.choices, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name
