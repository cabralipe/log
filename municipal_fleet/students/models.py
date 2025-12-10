from django.db import models
from django.db.models import Q


class School(models.Model):
    class SchoolType(models.TextChoices):
        MUNICIPAL = "MUNICIPAL", "Municipal"
        ESTADUAL = "ESTADUAL", "Estadual"
        PARTICULAR = "PARTICULAR", "Particular"
        FEDERAL = "FEDERAL", "Federal"
        OTHER = "OTHER", "Outro"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="schools"
    )
    name = models.CharField(max_length=255)
    inep_code = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    type = models.CharField(max_length=20, choices=SchoolType.choices, default=SchoolType.MUNICIPAL)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("municipality", "name")

    def __str__(self) -> str:
        return self.name


class Student(models.Model):
    class Shift(models.TextChoices):
        MORNING = "MORNING", "Manhã"
        AFTERNOON = "AFTERNOON", "Tarde"
        FULLTIME = "FULLTIME", "Integral"
        EVENING = "EVENING", "Noite"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        TRANSFERRED = "TRANSFERRED", "Transferido"
        INACTIVE = "INACTIVE", "Inativo"
        GRADUATED = "GRADUATED", "Formado"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="students"
    )
    school = models.ForeignKey(School, on_delete=models.PROTECT, related_name="students")
    full_name = models.CharField(max_length=255)
    social_name = models.CharField(max_length=255, blank=True)
    date_of_birth = models.DateField()
    cpf = models.CharField(max_length=20, db_index=True)
    registration_number = models.CharField(max_length=100, blank=True)
    grade = models.CharField(max_length=50, blank=True)
    shift = models.CharField(max_length=20, choices=Shift.choices, default=Shift.MORNING)
    address = models.CharField(max_length=255, blank=True)
    district = models.CharField(max_length=100, blank=True)
    has_special_needs = models.BooleanField(default=False)
    special_needs_details = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["municipality", "cpf"],
                condition=Q(status="ACTIVE"),
                name="unique_active_student_cpf_per_municipality",
            )
        ]

    def __str__(self) -> str:
        return self.full_name


class StudentCard(models.Model):
    class CardType(models.TextChoices):
        TRANSPORT = "TRANSPORT", "Transporte"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativa"
        BLOCKED = "BLOCKED", "Bloqueada"
        EXPIRED = "EXPIRED", "Expirada"
        REPLACED = "REPLACED", "Substituída"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="student_cards"
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="cards")
    card_number = models.CharField(max_length=64)
    type = models.CharField(max_length=20, choices=CardType.choices, default=CardType.TRANSPORT)
    issue_date = models.DateField()
    expiration_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    qr_payload = models.CharField(max_length=255, blank=True)
    printed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("municipality", "card_number")
        constraints = [
            models.UniqueConstraint(
                fields=["student", "type"],
                condition=Q(status="ACTIVE"),
                name="unique_active_card_per_student_type",
            )
        ]

    def __str__(self) -> str:
        return self.card_number


class StudentTransportRegistration(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"
        SUSPENDED = "SUSPENDED", "Suspenso"
        CANCELLED = "CANCELLED", "Cancelado"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="student_transport_registrations"
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="transport_registrations")
    school = models.ForeignKey(School, on_delete=models.PROTECT, related_name="transport_registrations")
    pickup_address = models.CharField(max_length=255)
    pickup_district = models.CharField(max_length=100, blank=True)
    dropoff_address = models.CharField(max_length=255)
    dropoff_district = models.CharField(max_length=100, blank=True)
    shift = models.CharField(max_length=20, choices=Student.Shift.choices, default=Student.Shift.MORNING)
    days_of_week = models.JSONField(default=list, blank=True)
    route_name = models.CharField(max_length=255, blank=True)
    allowed_contract = models.ForeignKey(
        "contracts.Contract",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_transport_registrations",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.student.full_name} - {self.shift}"
