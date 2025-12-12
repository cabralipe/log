import secrets
from django.db import models


def generate_access_code():
    # 8 hex chars (4 bytes) keeps codes short but hard to guess.
    return secrets.token_hex(4).upper()


class Driver(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        INACTIVE = "INACTIVE", "Inativo"

    municipality = models.ForeignKey("tenants.Municipality", on_delete=models.CASCADE, related_name="drivers")
    name = models.CharField(max_length=255)
    cpf = models.CharField(max_length=14)
    cnh_number = models.CharField(max_length=20)
    cnh_category = models.CharField(max_length=5)
    cnh_expiration_date = models.DateField()
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    access_code = models.CharField(max_length=20, unique=True, default=generate_access_code)
    free_trip_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("municipality", "cpf")

    def __str__(self):
        return self.name
