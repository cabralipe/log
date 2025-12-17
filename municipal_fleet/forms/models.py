import uuid
from django.db import models
from django.utils import timezone


def default_public_id() -> str:
    return uuid.uuid4().hex[:10]


class FormTemplate(models.Model):
    class FormType(models.TextChoices):
        STUDENT_CARD_APPLICATION = "STUDENT_CARD_APPLICATION", "Solicitação de Carteirinha"
        TRANSPORT_REQUEST = "TRANSPORT_REQUEST", "Solicitação de Transporte"
        GENERIC = "GENERIC", "Genérico"

    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="form_templates"
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=64, unique=True, default=default_public_id)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    require_cpf = models.BooleanField(default=True)
    form_type = models.CharField(
        max_length=64, choices=FormType.choices, default=FormType.STUDENT_CARD_APPLICATION
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.form_type == self.FormType.STUDENT_CARD_APPLICATION:
            self.require_cpf = True
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class FormQuestion(models.Model):
    class QuestionType(models.TextChoices):
        SHORT_TEXT = "SHORT_TEXT", "Resposta Curta"
        LONG_TEXT = "LONG_TEXT", "Parágrafo"
        MULTIPLE_CHOICE = "MULTIPLE_CHOICE", "Múltipla Escolha"
        CHECKBOXES = "CHECKBOXES", "Caixas de Seleção"
        DROPDOWN = "DROPDOWN", "Menu Suspenso"
        LINEAR_SCALE = "LINEAR_SCALE", "Escala Linear"
        MULTIPLE_CHOICE_GRID = "MULTIPLE_CHOICE_GRID", "Grade de Múltipla Escolha"
        CHECKBOX_GRID = "CHECKBOX_GRID", "Grade de Caixas de Seleção"
        DATE = "DATE", "Data"
        TIME = "TIME", "Hora"
        FILE_UPLOAD = "FILE_UPLOAD", "Upload de Arquivo"

    form_template = models.ForeignKey(
        FormTemplate, on_delete=models.CASCADE, related_name="questions"
    )
    order = models.PositiveIntegerField(default=0)
    label = models.CharField(max_length=255)
    help_text = models.CharField(max_length=255, blank=True)
    field_name = models.SlugField(max_length=100)
    type = models.CharField(max_length=32, choices=QuestionType.choices)
    required = models.BooleanField(default=False)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("form_template", "field_name")

    def __str__(self) -> str:
        return f"{self.form_template.name} - {self.label}"


class FormOption(models.Model):
    question = models.ForeignKey(FormQuestion, on_delete=models.CASCADE, related_name="options")
    label = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.label


class FormSubmission(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        APPROVED = "APPROVED", "Aprovado"
        REJECTED = "REJECTED", "Rejeitado"
        NEEDS_CORRECTION = "NEEDS_CORRECTION", "Correção Necessária"

    form_template = models.ForeignKey(
        FormTemplate, on_delete=models.CASCADE, related_name="submissions"
    )
    municipality = models.ForeignKey(
        "tenants.Municipality", on_delete=models.CASCADE, related_name="form_submissions"
    )
    cpf = models.CharField(max_length=20, db_index=True)
    protocol_number = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    status_notes = models.TextField(blank=True)
    linked_student = models.ForeignKey(
        "students.Student", on_delete=models.SET_NULL, null=True, blank=True, related_name="form_submissions"
    )
    linked_student_card = models.ForeignKey(
        "students.StudentCard",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="form_submissions",
    )
    linked_trip = models.ForeignKey(
        "trips.Trip",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="form_submissions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.protocol_number

    @staticmethod
    def next_protocol_number(municipality) -> str:
        """
        Generate sequential protocol per municipality per year.
        Example: M001-2025-000123
        """
        year = timezone.now().year
        prefix = f"M{municipality.id:03d}-{year}"
        seq = (
            FormSubmission.objects.filter(municipality=municipality, created_at__year=year)
            .order_by()
            .count()
            + 1
        )
        return f"{prefix}-{seq:06d}"

    def set_protocol_if_needed(self):
        if not self.protocol_number:
            self.protocol_number = self.next_protocol_number(self.municipality)

    def save(self, *args, **kwargs):
        self.set_protocol_if_needed()
        super().save(*args, **kwargs)


def form_answer_upload_path(instance: "FormAnswer", filename: str) -> str:
    return f"form_submissions/{instance.submission_id}/{filename}"


class FormAnswer(models.Model):
    submission = models.ForeignKey(FormSubmission, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(FormQuestion, on_delete=models.CASCADE, related_name="answers")
    value_text = models.TextField(blank=True)
    value_json = models.JSONField(null=True, blank=True)
    file = models.FileField(upload_to=form_answer_upload_path, null=True, blank=True)
    modified_by_staff = models.BooleanField(default=False)
    staff_value_text = models.TextField(blank=True)
    staff_value_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["question__order", "id"]

    def __str__(self) -> str:
        return f"Resposta {self.question.label}"
