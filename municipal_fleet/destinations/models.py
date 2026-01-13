from django.db import models


class Destination(models.Model):
    class DestinationType(models.TextChoices):
        SCHOOL = "SCHOOL", "Escola"
        HEALTH_UNIT = "HEALTH_UNIT", "Unidade de Saúde"
        EVENT = "EVENT", "Evento"
        OTHER = "OTHER", "Outro"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="destinations"
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=32, choices=DestinationType.choices, default=DestinationType.OTHER)
    address = models.CharField(max_length=255)
    number = models.CharField(max_length=32, blank=True)
    district = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("municipality", "name")

    def __str__(self) -> str:
        return self.name
