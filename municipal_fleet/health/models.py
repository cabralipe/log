from django.db import models


class Patient(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        INACTIVE = "INACTIVE", "Inativo"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="patients"
    )
    full_name = models.CharField(max_length=255)
    cpf = models.CharField(max_length=20, db_index=True)
    date_of_birth = models.DateField()
    comorbidities = models.TextField(blank=True)
    needs_companion = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]
        unique_together = ("municipality", "cpf")

    def __str__(self) -> str:
        return self.full_name


class Companion(models.Model):
    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="companions"
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="companions")
    full_name = models.CharField(max_length=255)
    cpf = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    relationship = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return self.full_name
