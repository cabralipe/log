from datetime import date, timedelta
from django.utils import timezone
from rest_framework import serializers
from forms.models import (
    FormTemplate,
    FormQuestion,
    FormOption,
    FormSubmission,
    FormAnswer,
)
from students.models import Student, StudentCard, School


class FormOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormOption
        fields = ["id", "label", "value", "order"]
        read_only_fields = ["id"]


class FormQuestionSerializer(serializers.ModelSerializer):
    options = FormOptionSerializer(many=True, read_only=True)

    class Meta:
        model = FormQuestion
        fields = [
            "id",
            "form_template",
            "order",
            "label",
            "help_text",
            "field_name",
            "type",
            "required",
            "config",
            "options",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        template = attrs.get("form_template") or getattr(self.instance, "form_template", None)
        field_name = attrs.get("field_name") or getattr(self.instance, "field_name", None)
        required = attrs.get("required", getattr(self.instance, "required", False))
        if template and template.require_cpf and field_name == "cpf" and not required:
            raise serializers.ValidationError("O campo CPF deve ser obrigatório.")
        return attrs


class FormTemplateSerializer(serializers.ModelSerializer):
    questions = FormQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = FormTemplate
        fields = [
            "id",
            "municipality",
            "name",
            "slug",
            "description",
            "is_active",
            "require_cpf",
            "form_type",
            "questions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            # Allow blank/omitted slug so backend auto-generates one.
            "slug": {"allow_blank": True, "required": False},
        }

    @staticmethod
    def _cleanup_slug(attrs):
        """
        Remove empty slug so model default kicks in.
        """
        if attrs.get("slug", None) == "":
            attrs.pop("slug", None)
        return attrs

    def validate(self, attrs):
        form_type = attrs.get("form_type", getattr(self.instance, "form_type", None))
        attrs = self._cleanup_slug(attrs)
        if form_type == FormTemplate.FormType.STUDENT_CARD_APPLICATION:
            attrs["require_cpf"] = True
        return attrs

    def create(self, validated_data):
        validated_data = self._cleanup_slug(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._cleanup_slug(validated_data)
        return super().update(instance, validated_data)


class FormAnswerSerializer(serializers.ModelSerializer):
    question_label = serializers.CharField(source="question.label", read_only=True)
    field_name = serializers.CharField(source="question.field_name", read_only=True)

    class Meta:
        model = FormAnswer
        fields = [
            "id",
            "question",
            "question_label",
            "field_name",
            "value_text",
            "value_json",
            "file",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "question_label", "field_name"]


class FormSubmissionSerializer(serializers.ModelSerializer):
    answers = FormAnswerSerializer(many=True, read_only=True)
    form_name = serializers.CharField(source="form_template.name", read_only=True)

    class Meta:
        model = FormSubmission
        fields = [
            "id",
            "form_template",
            "form_name",
            "municipality",
            "cpf",
            "protocol_number",
            "status",
            "status_notes",
            "linked_student",
            "linked_student_card",
            "answers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "protocol_number",
            "linked_student",
            "linked_student_card",
            "created_at",
            "updated_at",
        ]


class FormSubmissionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FormSubmission.Status.choices)
    status_notes = serializers.CharField(allow_blank=True, required=False)

    def validate_status(self, value):
        if value not in [
            FormSubmission.Status.APPROVED,
            FormSubmission.Status.REJECTED,
            FormSubmission.Status.NEEDS_CORRECTION,
        ]:
            raise serializers.ValidationError("Status de revisão inválido.")
        return value


class PublicFormQuestionSerializer(serializers.ModelSerializer):
    options = FormOptionSerializer(many=True, read_only=True)

    class Meta:
        model = FormQuestion
        fields = [
            "id",
            "order",
            "label",
            "help_text",
            "field_name",
            "type",
            "required",
            "config",
            "options",
        ]
        read_only_fields = fields


class PublicFormTemplateSerializer(serializers.ModelSerializer):
    questions = PublicFormQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = FormTemplate
        fields = ["id", "name", "slug", "description", "form_type", "questions"]
        read_only_fields = fields


class PublicSubmissionStatusSerializer(serializers.ModelSerializer):
    form_name = serializers.CharField(source="form_template.name", read_only=True)
    card = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()

    class Meta:
        model = FormSubmission
        fields = [
            "protocol_number",
            "status",
            "status_notes",
            "form_name",
            "card",
            "student",
            "created_at",
            "updated_at",
        ]

    def get_card(self, obj):
        card = obj.linked_student_card
        if not card:
            return None
        return {
            "card_number": card.card_number,
            "status": card.status,
            "expiration_date": card.expiration_date,
            "qr_payload": card.qr_payload,
        }

    def get_student(self, obj):
        student = obj.linked_student
        if not student:
            return None
        return {
            "id": student.id,
            "full_name": student.full_name,
            "school": student.school.name if student.school else None,
            "grade": student.grade,
            "shift": student.shift,
        }


class StudentFromSubmissionMapper:
    """
    Helper to map FormSubmission answers into Student fields.
    """

    FIELD_MAP = {
        "full_name": "full_name",
        "social_name": "social_name",
        "date_of_birth": "date_of_birth",
        "cpf": "cpf",
        "registration_number": "registration_number",
        "grade": "grade",
        "shift": "shift",
        "address": "address",
        "district": "district",
        "special_needs_details": "special_needs_details",
    }

    def __init__(self, submission: FormSubmission):
        self.submission = submission
        self.answer_lookup = {ans.question.field_name: ans for ans in submission.answers.all()}

    def get_value(self, field_name: str):
        answer = self.answer_lookup.get(field_name)
        if not answer:
            return None
        if answer.value_json is not None:
            return answer.value_json
        return answer.value_text

    def build_student_kwargs(self):
        data = {}
        for question_field, student_field in self.FIELD_MAP.items():
            value = self.get_value(question_field)
            if value:
                data[student_field] = value
        # boolean handling
        has_special_needs = self.get_value("has_special_needs")
        if has_special_needs is not None:
            if isinstance(has_special_needs, str):
                data["has_special_needs"] = has_special_needs.lower() in ["true", "1", "yes", "sim"]
            else:
                data["has_special_needs"] = bool(has_special_needs)
        # parse date
        dob_raw = data.get("date_of_birth")
        if dob_raw and isinstance(dob_raw, str):
            try:
                data["date_of_birth"] = date.fromisoformat(dob_raw)
            except ValueError:
                data.pop("date_of_birth", None)
        return data

    def resolve_school(self, municipality):
        school_id = self.get_value("school_id")
        school_name = self.get_value("school_name")
        if school_id:
            school = School.objects.filter(id=school_id, municipality=municipality).first()
            if school:
                return school
        if school_name:
            school, _ = School.objects.get_or_create(
                municipality=municipality,
                name=school_name,
                defaults={"city": getattr(municipality, "city", ""), "district": ""},
            )
            return school
        return None

    def ensure_student(self):
        municipality = self.submission.municipality
        cpf = self.submission.cpf
        student = Student.objects.filter(municipality=municipality, cpf=cpf).first()
        if student:
            return student
        data = self.build_student_kwargs()
        school = self.resolve_school(municipality)
        if not school:
            raise serializers.ValidationError("Escola não informada ou não encontrada para criar o aluno.")
        data.setdefault("full_name", "Aluno")
        data.setdefault("date_of_birth", timezone.localdate() - timedelta(days=3650))
        data["municipality"] = municipality
        data["school"] = school
        data.setdefault("shift", Student.Shift.MORNING)
        return Student.objects.create(**data)

    def issue_card(self, student: Student):
        existing_active = student.cards.filter(
            type=StudentCard.CardType.TRANSPORT, status=StudentCard.Status.ACTIVE
        )
        for card in existing_active:
            card.status = StudentCard.Status.REPLACED
            card.save(update_fields=["status"])

        municipality = student.municipality
        today = timezone.localdate()
        year = today.year
        seq = (
            StudentCard.objects.filter(municipality=municipality, issue_date__year=year)
            .order_by()
            .count()
            + 1
        )
        card_number = f"C{municipality.id:03d}-{year}-{seq:06d}"
        expiration_date = (date(year + 1, 3, 1) - timedelta(days=1))
        card = StudentCard.objects.create(
            municipality=municipality,
            student=student,
            card_number=card_number,
            type=StudentCard.CardType.TRANSPORT,
            issue_date=today,
            expiration_date=expiration_date,
            status=StudentCard.Status.ACTIVE,
        )
        card.qr_payload = f"STDCARD:{municipality.id}:{student.id}:{card.id}"
        card.save(update_fields=["qr_payload"])
        return card
