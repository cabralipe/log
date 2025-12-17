from django.db import models
from django.conf import settings


class DriverAvailabilityBlock(models.Model):
    class BlockType(models.TextChoices):
        VACATION = "VACATION", "Férias"
        SICK_LEAVE = "SICK_LEAVE", "Afastamento/Atestado"
        DAY_OFF = "DAY_OFF", "Folga"
        TRAINING = "TRAINING", "Treinamento"
        ADMIN_BLOCK = "ADMIN_BLOCK", "Bloqueio administrativo"
        OTHER = "OTHER", "Outro"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        CANCELLED = "CANCELLED", "Cancelado"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="driver_availability_blocks"
    )
    driver = models.ForeignKey("drivers.Driver", on_delete=models.CASCADE, related_name="availability_blocks")
    type = models.CharField(max_length=32, choices=BlockType.choices)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_blocks"
    )
    attachment = models.FileField(upload_to="driver_blocks/attachments/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_datetime", "-created_at"]

    def __str__(self) -> str:
        return f"{self.driver} indisponível ({self.get_type_display()})"


class DriverWorkSchedule(models.Model):
    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="driver_work_schedules"
    )
    driver = models.ForeignKey("drivers.Driver", on_delete=models.CASCADE, related_name="work_schedules")
    weekday = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["driver_id", "weekday", "start_time"]
        unique_together = ("driver", "weekday", "start_time", "end_time")

    def __str__(self) -> str:
        return f"{self.driver} - {self.weekday} ({self.start_time} - {self.end_time})"
