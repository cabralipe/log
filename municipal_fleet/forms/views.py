import json
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, response, status, exceptions, views, parsers, filters
from rest_framework.decorators import action
from forms.models import FormTemplate, FormQuestion, FormSubmission, FormAnswer, FormOption
from forms.serializers import (
    FormTemplateSerializer,
    FormQuestionSerializer,
    FormOptionSerializer,
    FormSubmissionSerializer,
    FormSubmissionReviewSerializer,
    PublicFormTemplateSerializer,
    PublicSubmissionStatusSerializer,
    StudentFromSubmissionMapper,
    TransportRequestMapper,
)
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly, IsMunicipalityAdmin
from students.models import StudentCard
from trips.serializers import TripSerializer
from drivers.models import Driver
from fleet.models import Vehicle


def create_default_transport_questions(template: FormTemplate):
    """
    Seed a transport request form with the basic fields needed to generate a Trip.
    Only runs when the template has no questions yet to avoid duplicates.
    """
    if template.questions.exists():
        return
    defaults = [
        ("CPF do solicitante", "cpf", FormQuestion.QuestionType.SHORT_TEXT, True, ""),
        ("Nome do solicitante", "requester_name", FormQuestion.QuestionType.SHORT_TEXT, True, ""),
        ("Contato (telefone ou e-mail)", "requester_contact", FormQuestion.QuestionType.SHORT_TEXT, True, ""),
        ("Origem", "origin", FormQuestion.QuestionType.SHORT_TEXT, True, ""),
        ("Destino", "destination", FormQuestion.QuestionType.SHORT_TEXT, True, ""),
        ("Data de saída", "departure_date", FormQuestion.QuestionType.DATE, True, ""),
        ("Horário de saída", "departure_time", FormQuestion.QuestionType.TIME, True, ""),
        ("Data de retorno", "return_date", FormQuestion.QuestionType.DATE, True, ""),
        ("Horário de retorno", "return_time", FormQuestion.QuestionType.TIME, True, ""),
        ("Quantidade de passageiros", "passengers_count", FormQuestion.QuestionType.SHORT_TEXT, False, "0"),
        ("Listar passageiros (opcional)", "passengers_details", FormQuestion.QuestionType.LONG_TEXT, False, ""),
        ("Precisa de motorista dedicado?", "need_driver", FormQuestion.QuestionType.MULTIPLE_CHOICE, True, "yes"),
        ("Precisa reservar veículo?", "need_vehicle", FormQuestion.QuestionType.MULTIPLE_CHOICE, True, "yes"),
        ("Motorista", "driver_id", FormQuestion.QuestionType.DROPDOWN, False, ""),
        ("Veículo", "vehicle_id", FormQuestion.QuestionType.DROPDOWN, False, ""),
        ("Anexar ofício (PDF)", "request_letter", FormQuestion.QuestionType.FILE_UPLOAD, True, ""),
        ("Observações", "notes", FormQuestion.QuestionType.LONG_TEXT, False, ""),
    ]
    order = 1
    for label, field_name, qtype, required, default_value in defaults:
        question = FormQuestion.objects.create(
            form_template=template,
            order=order,
            label=label,
            field_name=field_name,
            type=qtype,
            required=required,
            config={"default": default_value} if default_value != "" else {},
        )
        if field_name in ["need_driver", "need_vehicle"]:
            FormOption.objects.bulk_create(
                [
                    FormOption(question=question, label="Sim", value="yes", order=1),
                    FormOption(question=question, label="Não", value="no", order=2),
                ]
            )
        if field_name == "driver_id":
            drivers = Driver.objects.filter(municipality=template.municipality, status=Driver.Status.ACTIVE).order_by("name")[:200]
            FormOption.objects.bulk_create(
                [FormOption(question=question, label=drv.name, value=str(drv.id), order=idx + 1) for idx, drv in enumerate(drivers)]
            )
        if field_name == "vehicle_id":
            vehicles = (
                Vehicle.objects.filter(municipality=template.municipality, status=Vehicle.Status.AVAILABLE)
                .order_by("license_plate")[:200]
            )
            FormOption.objects.bulk_create(
                [
                    FormOption(question=question, label=f"{veh.license_plate} — {veh.model}", value=str(veh.id), order=idx + 1)
                    for idx, veh in enumerate(vehicles)
                ]
            )
        order += 1


class FormTemplateViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = FormTemplate.objects.all().prefetch_related("questions")
    serializer_class = FormTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        form_type = self.request.query_params.get("form_type")
        if form_type:
            qs = qs.filter(form_type=form_type)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        municipality = user.municipality if user.role != "SUPERADMIN" else serializer.validated_data.get("municipality")
        template = serializer.save(municipality=municipality)
        if template.form_type == FormTemplate.FormType.TRANSPORT_REQUEST:
            create_default_transport_questions(template)


class FormQuestionViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = FormQuestion.objects.select_related("form_template")
    serializer_class = FormQuestionSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdmin]
    municipality_field = "form_template__municipality"
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["order"]

    def _ensure_cpf_present(self, template: FormTemplate):
        if template.require_cpf and not template.questions.filter(field_name="cpf", required=True).exists():
            raise exceptions.ValidationError("Formulário de carteirinha precisa ter uma pergunta de CPF obrigatória.")

    def perform_create(self, serializer):
        template = serializer.validated_data["form_template"]
        if template.require_cpf and template.form_type == FormTemplate.FormType.STUDENT_CARD_APPLICATION:
            if serializer.validated_data.get("field_name") != "cpf" and not template.questions.filter(field_name="cpf").exists():
                raise exceptions.ValidationError("Crie primeiro a pergunta de CPF obrigatória.")
        if template.require_cpf and serializer.validated_data.get("field_name") == "cpf" and not serializer.validated_data.get("required", False):
            raise exceptions.ValidationError("O campo CPF deve ser obrigatório.")
        serializer.save()
        self._ensure_cpf_present(template)

    def perform_update(self, serializer):
        instance = self.get_object()
        template = instance.form_template
        new_field_name = serializer.validated_data.get("field_name", instance.field_name)
        if template.require_cpf and instance.field_name == "cpf" and new_field_name != "cpf":
            raise exceptions.ValidationError("Não é permitido remover ou renomear o campo de CPF.")
        updated = serializer.save()
        self._ensure_cpf_present(updated.form_template)

    def perform_destroy(self, instance):
        template = instance.form_template
        if template.require_cpf and instance.field_name == "cpf":
            raise exceptions.ValidationError("O campo de CPF não pode ser removido.")
        super().perform_destroy(instance)
        self._ensure_cpf_present(template)

    @action(detail=True, methods=["post"], url_path="refresh-options", permission_classes=[permissions.IsAuthenticated, IsMunicipalityAdmin])
    def refresh_options(self, request, pk=None):
        template = self.get_object()
        if template.form_type != FormTemplate.FormType.TRANSPORT_REQUEST:
            return response.Response({"detail": "Apenas para formulários de transporte."}, status=status.HTTP_400_BAD_REQUEST)
        create_default_transport_questions(template)
        return response.Response({"detail": "Opções atualizadas."})


class FormOptionViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = FormOption.objects.select_related("question", "question__form_template")
    serializer_class = FormOptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdmin]
    municipality_field = "question__form_template__municipality"

    def get_queryset(self):
        qs = super().get_queryset()
        question_id = self.request.query_params.get("question")
        if question_id:
            qs = qs.filter(question_id=question_id)
        return qs


class FormSubmissionViewSet(MunicipalityQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = FormSubmissionSerializer
    queryset = FormSubmission.objects.select_related(
        "form_template",
        "municipality",
        "linked_student",
        "linked_student_card",
        "linked_trip",
    ).prefetch_related("answers__question")
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        form_template = self.request.query_params.get("form_template")
        cpf = self.request.query_params.get("cpf")
        status_param = self.request.query_params.get("status")
        municipality_param = self.request.query_params.get("municipality")
        if form_template:
            qs = qs.filter(form_template_id=form_template)
        if cpf:
            qs = qs.filter(cpf=cpf)
        if status_param:
            qs = qs.filter(status=status_param)
        if municipality_param:
            qs = qs.filter(municipality_id=municipality_param)
        return qs

    @transaction.atomic
    def _approve_student_submission(self, submission: FormSubmission, notes: str):
        mapper = StudentFromSubmissionMapper(submission)
        student = mapper.ensure_student()
        card = mapper.issue_card(student)
        submission.status = FormSubmission.Status.APPROVED
        submission.status_notes = notes
        submission.linked_student = student
        submission.linked_student_card = card
        submission.save()
        return submission

    @transaction.atomic
    def _approve_transport_submission(self, submission: FormSubmission, notes: str, request):
        mapper = TransportRequestMapper(submission)
        trip_payload = mapper.build_trip_payload()
        serializer = TripSerializer(data=trip_payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        trip = serializer.save()
        mapper.apply_post_actions(trip)
        submission.status = FormSubmission.Status.APPROVED
        submission.status_notes = notes or "Solicitação aprovada e viagem criada automaticamente."
        submission.linked_trip = trip
        submission.save(update_fields=["status", "status_notes", "linked_trip", "updated_at"])
        return submission

    def _block_linked_card(self, submission: FormSubmission):
        card = submission.linked_student_card
        if not card:
            return
        if card.status == StudentCard.Status.ACTIVE:
            card.status = StudentCard.Status.BLOCKED
            card.save(update_fields=["status", "updated_at"])

    @transaction.atomic
    def _apply_updates(self, submission: FormSubmission, updates: dict):
        if not updates:
            return
        answers = {ans.question.field_name: ans for ans in submission.answers.select_related("question")}
        for field, value in updates.items():
            ans = answers.get(field)
            if not ans:
                continue
            ans.modified_by_staff = True
            ans.staff_value_json = None
            ans.staff_value_text = str(value)
            ans.save(update_fields=["modified_by_staff", "staff_value_text", "staff_value_json"])

    def _update_status(self, submission: FormSubmission, status_value: str, notes: str, request, updates: dict | None = None):
        if updates:
            self._apply_updates(submission, updates)
        if status_value == FormSubmission.Status.APPROVED:
            if submission.form_template.form_type == FormTemplate.FormType.TRANSPORT_REQUEST:
                return self._approve_transport_submission(submission, notes, request)
            return self._approve_student_submission(submission, notes)
        if status_value == FormSubmission.Status.REJECTED:
            self._block_linked_card(submission)
        submission.status = status_value
        submission.status_notes = notes
        submission.save(update_fields=["status", "status_notes", "linked_student", "linked_student_card", "updated_at"])
        return submission

    def get_permissions(self):
        if self.action == "retrieve":
            return [permissions.IsAuthenticated(), IsMunicipalityAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"], url_path="review", permission_classes=[permissions.IsAuthenticated, IsMunicipalityAdmin])
    @transaction.atomic
    def review(self, request, pk=None):
        submission = self.get_object()
        serializer = FormSubmissionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        status_value = serializer.validated_data["status"]
        notes = serializer.validated_data.get("status_notes", "")
        updates = serializer.validated_data.get("updates") or {}
        try:
            submission = self._update_status(submission, status_value, notes, request, updates)
        except serializers.ValidationError as exc:  # type: ignore
            return response.Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(FormSubmissionSerializer(submission).data)


class PublicFormDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug: str):
        template = get_object_or_404(FormTemplate, slug=slug, is_active=True)
        data = PublicFormTemplateSerializer(template).data
        if template.form_type == FormTemplate.FormType.TRANSPORT_REQUEST:
            driver_options = [
                {"id": drv.id, "label": drv.name, "value": str(drv.id)}
                for drv in Driver.objects.filter(municipality=template.municipality, status=Driver.Status.ACTIVE).order_by("name")[:200]
            ]
            vehicle_options = [
                {"id": veh.id, "label": f"{veh.license_plate} — {veh.model}", "value": str(veh.id)}
                for veh in Vehicle.objects.filter(municipality=template.municipality, status=Vehicle.Status.AVAILABLE).order_by("license_plate")[:200]
            ]
            for q in data.get("questions", []):
                if q.get("field_name") == "driver_id":
                    q["options"] = driver_options
                if q.get("field_name") == "vehicle_id":
                    q["options"] = vehicle_options
        return response.Response(data)


class PublicFormSubmitView(views.APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def _parse_value(self, raw_value, expect_json=False):
        if expect_json and isinstance(raw_value, str):
            try:
                return json.loads(raw_value)
            except json.JSONDecodeError:
                return raw_value
        return raw_value

    def _clean_answer(self, question: FormQuestion, raw_value, raw_file):
        required = question.required
        qtype = question.type
        if qtype == FormQuestion.QuestionType.FILE_UPLOAD:
            if required and not raw_file:
                raise exceptions.ValidationError({question.field_name: "Arquivo obrigatório."})
            return {"file": raw_file}
        if raw_value in [None, "", []]:
            if required:
                raise exceptions.ValidationError({question.field_name: "Campo obrigatório."})
            return {"value_text": ""}
        if qtype in [
            FormQuestion.QuestionType.CHECKBOXES,
            FormQuestion.QuestionType.MULTIPLE_CHOICE_GRID,
            FormQuestion.QuestionType.CHECKBOX_GRID,
        ]:
            parsed = self._parse_value(raw_value, expect_json=True)
            if not isinstance(parsed, (list, dict)):
                raise exceptions.ValidationError({question.field_name: "Formato inválido, envie lista ou objeto."})
            return {"value_json": parsed}
        if qtype == FormQuestion.QuestionType.LINEAR_SCALE:
            try:
                int(raw_value)
            except (TypeError, ValueError):
                raise exceptions.ValidationError({question.field_name: "Valor inválido para escala."})
            return {"value_text": str(raw_value)}
        return {"value_text": str(raw_value)}

    @transaction.atomic
    def post(self, request, slug: str):
        template = get_object_or_404(FormTemplate, slug=slug, is_active=True)
        questions = list(template.questions.all())
        cpf_question = next((q for q in questions if q.field_name == "cpf"), None)
        if template.require_cpf and not cpf_question:
            raise exceptions.ValidationError("Formulário inválido: campo CPF obrigatório não configurado.")
        answers_payload = []
        cpf_value = None

        for question in questions:
            raw_value = request.data.get(question.field_name)
            raw_file = request.FILES.get(question.field_name)
            cleaned = self._clean_answer(question, raw_value, raw_file)
            if question.field_name == "cpf":
                cpf_value = raw_value or cleaned.get("value_text")
            answers_payload.append((question, cleaned))

        if template.require_cpf and not cpf_value:
            raise exceptions.ValidationError({"cpf": "CPF é obrigatório."})

        submission = FormSubmission.objects.create(
            form_template=template,
            municipality=template.municipality,
            cpf=cpf_value,
            status=FormSubmission.Status.PENDING,
        )
        for question, cleaned in answers_payload:
            FormAnswer.objects.create(submission=submission, question=question, **cleaned)
        return response.Response(
            {"protocol_number": submission.protocol_number, "message": "Inscrição registrada com sucesso."},
            status=status.HTTP_201_CREATED,
        )


class PublicFormStatusView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug: str):
        cpf = request.query_params.get("cpf")
        if not cpf:
            return response.Response({"detail": "Informe o CPF."}, status=status.HTTP_400_BAD_REQUEST)
        template = get_object_or_404(FormTemplate, slug=slug)
        submissions = (
            FormSubmission.objects.filter(form_template=template, cpf=cpf)
            .select_related("linked_student", "linked_student_card", "form_template", "linked_student__school")
            .prefetch_related("answers__question")
            .order_by("-created_at")
        )
        serializer = PublicSubmissionStatusSerializer(submissions, many=True)
        return response.Response({"submissions": serializer.data})
