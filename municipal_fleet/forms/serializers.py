from datetime import date, datetime, time, timedelta
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
from trips.serializers import TripSerializer
from trips.models import Trip
from fleet.models import Vehicle
from drivers.models import Driver
from scheduling.models import DriverAvailabilityBlock
from tenants.utils import resolve_municipality


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
            "municipality": {"required": False},
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
        request = self.context.get("request")
        user = getattr(request, "user", None)

        form_type = attrs.get("form_type", getattr(self.instance, "form_type", None))
        attrs = self._cleanup_slug(attrs)

        if not attrs.get("municipality"):
            municipality = resolve_municipality(request, attrs.get("municipality"))
            if municipality:
                attrs["municipality"] = municipality
        if not attrs.get("municipality"):
            raise serializers.ValidationError({"municipality": "Informe a prefeitura."})

        if form_type == FormTemplate.FormType.STUDENT_CARD_APPLICATION:
            attrs["require_cpf"] = True
        if form_type == FormTemplate.FormType.TRANSPORT_REQUEST:
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
    modified_by_staff = serializers.BooleanField(read_only=True)
    staff_value_text = serializers.CharField(read_only=True)
    staff_value_json = serializers.JSONField(read_only=True)

    class Meta:
        model = FormAnswer
        fields = [
            "id",
            "question",
            "question_label",
            "field_name",
            "value_text",
            "value_json",
            "modified_by_staff",
            "staff_value_text",
            "staff_value_json",
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
            "linked_trip",
            "answers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "protocol_number",
            "linked_student",
            "linked_student_card",
            "linked_trip",
            "created_at",
            "updated_at",
        ]


class FormSubmissionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FormSubmission.Status.choices)
    status_notes = serializers.CharField(allow_blank=True, required=False)
    updates = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False, allow_empty=True)

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
    municipality = serializers.IntegerField(source="municipality_id", read_only=True)
    schools = serializers.SerializerMethodField()

    class Meta:
        model = FormTemplate
        fields = ["id", "name", "slug", "description", "form_type", "questions", "municipality", "schools"]
        read_only_fields = fields

    def get_schools(self, obj: FormTemplate):
        if obj.form_type != FormTemplate.FormType.STUDENT_CARD_APPLICATION:
            return []
        schools = obj.municipality.schools.filter(is_active=True).order_by("name")
        return [{"id": s.id, "name": s.name} for s in schools]


class PublicSubmissionStatusSerializer(serializers.ModelSerializer):
    form_name = serializers.CharField(source="form_template.name", read_only=True)
    card = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()
    answers = FormAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = FormSubmission
        fields = [
            "protocol_number",
            "status",
            "status_notes",
            "form_name",
            "card",
            "student",
            "answers",
            "created_at",
            "updated_at",
        ]

    def get_card(self, obj):
        card = obj.linked_student_card
        if not card or obj.status != FormSubmission.Status.APPROVED:
            return None
        return {
            "card_number": card.card_number,
            "status": card.status,
            "expiration_date": card.expiration_date,
            "qr_payload": card.qr_payload,
        }

    def get_student(self, obj):
        # Expor somente campos que vieram do formulário.
        answers = getattr(obj, "answers", [])
        if hasattr(answers, "all"):
            answers = answers.all()
        answer_map = {ans.question.field_name: ans for ans in answers}

        def answer_value(field_name):
            ans = answer_map.get(field_name)
            if not ans:
                return None
            if ans.value_json is not None:
                return ans.value_json
            return ans.value_text

        data = {}
        full_name = answer_value("full_name")
        if full_name:
            data["full_name"] = full_name

        school_name = answer_value("school") or answer_value("school_name")
        if school_name:
            data["school"] = school_name
        else:
            school_id = answer_value("school_id")
            if school_id:
                data["school_id"] = school_id

        for field in ["grade", "shift", "course"]:
            value = answer_value(field)
            if value not in [None, ""]:
                if field == "shift" and isinstance(value, list):
                    allowed = {choice[0] for choice in Student.Shift.choices}
                    data[field] = [Student.Shift(choice).label if choice in allowed else str(choice) for choice in value]
                else:
                    data[field] = value

        return data or None


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
                if student_field == "shift" and isinstance(value, list):
                    data[student_field] = str(value[0]) if value else None
                elif student_field == "grade" and isinstance(value, list):
                    data[student_field] = str(value[0]) if value else None
                else:
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
            # fallback para não travar a emissão quando escola não foi preenchida
            school, _ = School.objects.get_or_create(
                municipality=municipality,
                name="Não informada",
                defaults={"city": getattr(municipality, "city", ""), "district": ""},
            )
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


class TransportRequestMapper:
    """
    Helper to map answers of a transport request into a Trip and related actions.
    """

    def __init__(self, submission: FormSubmission):
        self.submission = submission
        self.answer_map = {ans.question.field_name: ans for ans in submission.answers.select_related("question")}

    def _get_text(self, field: str, required=False, default: str | None = None) -> str:
        ans = self.answer_map.get(field)
        value_source = ans.staff_value_text if ans and ans.modified_by_staff and ans.staff_value_text else None
        value = value_source or (ans.value_text if ans else None) or default or ""
        if required and not value:
            raise serializers.ValidationError({field: "Campo obrigatório para gerar a viagem."})
        return value

    def _get_bool(self, field: str, default=False) -> bool:
        value = self._get_text(field, default=str(default).lower())
        return str(value).strip().lower() in {"true", "1", "yes", "sim", "on"}

    def _get_int(self, field: str, default: int = 0) -> int:
        value = self._get_text(field, default=str(default))
        if value == "":
            return default
        try:
            return int(float(value))
        except (TypeError, ValueError):
            raise serializers.ValidationError({field: "Valor numérico inválido."})

    def _parse_datetime(self, date_field: str, time_field: str) -> datetime:
        date_str = self._get_text(date_field, required=True)
        time_str = self._get_text(time_field, required=True)
        try:
            date_obj = date.fromisoformat(date_str)
        except ValueError:
            raise serializers.ValidationError({date_field: "Data inválida."})
        try:
            time_obj = time.fromisoformat(time_str)
        except ValueError:
            raise serializers.ValidationError({time_field: "Horário inválido."})
        dt = datetime.combine(date_obj, time_obj)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_default_timezone())
        return dt

    def build_trip_payload(self):
        departure = self._parse_datetime("departure_date", "departure_time")
        return_expected = self._parse_datetime("return_date", "return_time")
        if return_expected <= departure:
            raise serializers.ValidationError({"return_time": "Retorno deve ser após a saída."})

        need_driver = self._get_bool("need_driver", default=True)
        need_vehicle = self._get_bool("need_vehicle", default=True)
        vehicle_id = self._get_text("vehicle_id")
        driver_id = self._get_text("driver_id")
        if need_vehicle and not vehicle_id:
            auto_vehicle = (
                Vehicle.objects.filter(municipality=self.submission.municipality, status=Vehicle.Status.AVAILABLE)
                .order_by("license_plate")
                .first()
            )
            if auto_vehicle:
                vehicle_id = auto_vehicle.id
            else:
                raise serializers.ValidationError({"vehicle_id": "Selecione o veículo para gerar a viagem."})
        if need_driver and not driver_id:
            auto_driver = (
                Driver.objects.filter(municipality=self.submission.municipality, status=Driver.Status.ACTIVE)
                .order_by("name")
                .first()
            )
            if auto_driver:
                driver_id = auto_driver.id
            else:
                raise serializers.ValidationError({"driver_id": "Selecione o motorista para gerar a viagem."})
        if not need_vehicle and not vehicle_id:
            # Tentativa de auto-preencher para manter a viagem consistente, mas não obriga o solicitante.
            auto_vehicle = (
                Vehicle.objects.filter(municipality=self.submission.municipality, status=Vehicle.Status.AVAILABLE)
                .order_by("license_plate")
                .first()
            )
            if auto_vehicle:
                vehicle_id = auto_vehicle.id
        if not need_driver and not driver_id:
            auto_driver = (
                Driver.objects.filter(municipality=self.submission.municipality, status=Driver.Status.ACTIVE)
                .order_by("name")
                .first()
            )
            if auto_driver:
                driver_id = auto_driver.id

        if not vehicle_id:
            raise serializers.ValidationError({"vehicle_id": "Informe o veículo antes de aprovar a solicitação."})
        if not driver_id:
            raise serializers.ValidationError({"driver_id": "Informe o motorista antes de aprovar a solicitação."})

        try:
            vehicle_pk = int(vehicle_id)
            driver_pk = int(driver_id)
        except (TypeError, ValueError):
            raise serializers.ValidationError({"vehicle_id": "IDs de veículo e motorista devem ser numéricos."})

        passengers_text = self._get_text("passengers_details", default="")
        notes = self._get_text("notes", default="")
        if passengers_text:
            notes = (notes + "\n" if notes else "") + f"Passageiros informados: {passengers_text}"

        return {
            "origin": self._get_text("origin", required=True),
            "destination": self._get_text("destination", required=True),
            "departure_datetime": departure,
            "return_datetime_expected": return_expected,
            "vehicle": vehicle_pk,
            "driver": driver_pk,
            "municipality": self.submission.municipality,
            "passengers_count": max(0, self._get_int("passengers_count", default=0)),
            "notes": notes,
            "odometer_start": 0,
            "status": Trip.Status.PLANNED,
            "category": Trip.Category.PASSENGER,
            # request_letter is stored in FormAnswer; Trip doesn't need it directly.
        }

    def apply_post_actions(self, trip: Trip):
        need_driver_block = self._get_bool("need_driver", default=True)
        need_vehicle_lock = self._get_bool("need_vehicle", default=True)
        if need_driver_block:
            DriverAvailabilityBlock.objects.get_or_create(
                municipality=trip.municipality,
                driver=trip.driver,
                type=DriverAvailabilityBlock.BlockType.ADMIN_BLOCK,
                start_datetime=trip.departure_datetime,
                end_datetime=trip.return_datetime_expected,
                defaults={
                    "status": DriverAvailabilityBlock.Status.ACTIVE,
                    "reason": f"Bloqueio automático da solicitação {trip.id} / protocolo {self.submission.protocol_number}",
                },
            )
        if need_vehicle_lock:
            vehicle = trip.vehicle
            if vehicle.status != Vehicle.Status.IN_USE:
                vehicle.status = Vehicle.Status.IN_USE
                vehicle.save(update_fields=["status", "updated_at"])
