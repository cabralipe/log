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


class DriverGeofence(models.Model):
    driver = models.OneToOneField(Driver, on_delete=models.CASCADE, related_name="geofence")
    center_lat = models.DecimalField(max_digits=9, decimal_places=6)
    center_lng = models.DecimalField(max_digits=9, decimal_places=6)
    radius_m = models.PositiveIntegerField(default=500)
    is_active = models.BooleanField(default=True)
    alert_active = models.BooleanField(default=False)
    last_alerted_at = models.DateTimeField(null=True, blank=True)
    cleared_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Geofence {self.driver_id} ({self.radius_m}m)"
