from django.utils import timezone
from rest_framework import viewsets, permissions, exceptions, response, status
from rest_framework.views import APIView
from tenants.mixins import MunicipalityQuerysetMixin
from tenants.utils import resolve_municipality
from accounts.permissions import IsMunicipalityAdminOrReadOnly, IsMunicipalityAdmin
from students.models import School, Student, StudentCard, StudentTransportRegistration, ClassGroup
from forms.models import FormSubmission
from students.serializers import (
    SchoolSerializer,
    StudentSerializer,
    StudentCardSerializer,
    StudentTransportRegistrationSerializer,
    ClassGroupSerializer,
)


class BaseMunicipalityCreateMixin:
    """
    Helper to enforce municipality scoping on create.
    """

    def get_municipality(self, serializer):
        municipality = resolve_municipality(self.request, serializer.validated_data.get("municipality"))
        if not municipality:
            raise exceptions.ValidationError("Informe a prefeitura.")
        return municipality


class SchoolViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = School.objects.select_related("municipality")
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        destination = serializer.validated_data.get("destination")
        if destination and municipality and destination.municipality_id != municipality.id:
            raise exceptions.ValidationError("Destino precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)

    def perform_update(self, serializer):
        municipality = self.get_municipality(serializer)
        destination = serializer.validated_data.get("destination", serializer.instance.destination)
        if destination and municipality and destination.municipality_id != municipality.id:
            raise exceptions.ValidationError("Destino precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)


class ClassGroupViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = ClassGroup.objects.select_related("municipality", "school")
    serializer_class = ClassGroupSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        school = serializer.validated_data.get("school")
        if school and municipality and school.municipality_id != municipality.id:
            raise exceptions.ValidationError("Escola precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)

    def perform_update(self, serializer):
        municipality = self.get_municipality(serializer)
        school = serializer.validated_data.get("school", serializer.instance.school)
        if school and municipality and school.municipality_id != municipality.id:
            raise exceptions.ValidationError("Escola precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)


class StudentViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Student.objects.select_related("municipality", "school", "class_group")
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        school = serializer.validated_data.get("school")
        class_group = serializer.validated_data.get("class_group")
        if school and municipality and school.municipality_id != municipality.id:
            raise exceptions.ValidationError("Escola precisa pertencer à mesma prefeitura.")
        if class_group and municipality and class_group.municipality_id != municipality.id:
            raise exceptions.ValidationError("Turma precisa pertencer à mesma prefeitura.")
        if class_group and school and class_group.school_id != school.id:
            raise exceptions.ValidationError("Turma precisa pertencer à escola informada.")
        serializer.save(municipality=municipality)

    def perform_update(self, serializer):
        municipality = self.get_municipality(serializer)
        school = serializer.validated_data.get("school", serializer.instance.school)
        class_group = serializer.validated_data.get("class_group", serializer.instance.class_group)
        if school and municipality and school.municipality_id != municipality.id:
            raise exceptions.ValidationError("Escola precisa pertencer à mesma prefeitura.")
        if class_group and municipality and class_group.municipality_id != municipality.id:
            raise exceptions.ValidationError("Turma precisa pertencer à mesma prefeitura.")
        if class_group and school and class_group.school_id != school.id:
            raise exceptions.ValidationError("Turma precisa pertencer à escola informada.")
        serializer.save(municipality=municipality)


class StudentCardViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = StudentCard.objects.select_related("student", "municipality")
    serializer_class = StudentCardSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdmin]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        student = serializer.validated_data.get("student")
        if student and municipality and student.municipality_id != municipality.id:
            raise exceptions.ValidationError("Aluno precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)


class StudentTransportRegistrationViewSet(
    BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet
):
    queryset = StudentTransportRegistration.objects.select_related("student", "school", "municipality")
    serializer_class = StudentTransportRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        student = serializer.validated_data.get("student")
        school = serializer.validated_data.get("school")
        if student and municipality and student.municipality_id != municipality.id:
            raise exceptions.ValidationError("Aluno precisa pertencer à mesma prefeitura.")
        if school and municipality and school.municipality_id != municipality.id:
            raise exceptions.ValidationError("Escola precisa pertencer à mesma prefeitura.")
        serializer.save(municipality=municipality)


from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

class StudentCardValidateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("payload", OpenApiTypes.STR, description="QR Code Payload"),
            OpenApiParameter("qr_payload", OpenApiTypes.STR, description="Alias for payload"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        payload = request.query_params.get("payload") or request.query_params.get("qr_payload")
        if not payload:
            return response.Response({"detail": "Informe o payload do QR code."}, status=status.HTTP_400_BAD_REQUEST)
        card = (
            StudentCard.objects.select_related("student", "student__school", "municipality")
            .filter(qr_payload=payload)
            .first()
        )
        if not card:
            return response.Response({"valid": False, "reason": "CARD_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        if user.role != "SUPERADMIN" and user.municipality_id != card.municipality_id:
            return response.Response({"valid": False, "reason": "WRONG_MUNICIPALITY"})

        submission = (
            FormSubmission.objects.filter(linked_student_card=card)
            .prefetch_related("answers__question")
            .order_by("-created_at")
            .first()
        )

        if submission and submission.status == FormSubmission.Status.REJECTED:
            # Se a submissão foi rejeitada após emissão, inativamos a carteirinha e bloqueamos o QR.
            if card.status == StudentCard.Status.ACTIVE:
                card.status = StudentCard.Status.BLOCKED
                card.save(update_fields=["status", "updated_at"])
            return response.Response({"valid": False, "reason": FormSubmission.Status.REJECTED})

        today = timezone.localdate()
        if card.status != StudentCard.Status.ACTIVE:
            return response.Response({"valid": False, "reason": card.status})
        if card.expiration_date and card.expiration_date < today:
            return response.Response({"valid": False, "reason": "CARD_EXPIRED"})

        student_payload = None
        if submission:
            answers = submission.answers.all()
            answer_map = {ans.question.field_name: ans for ans in answers}

            def answer_value(field_name):
                ans = answer_map.get(field_name)
                if not ans:
                    return None
                if ans.value_json is not None:
                    return ans.value_json
                return ans.value_text

            def resolve_options(ans, values):
                if not ans or not isinstance(values, list):
                    return values
                options = list(ans.question.options.all())
                if not options:
                    return values
                option_map = {opt.value: opt.label for opt in options}
                return [option_map.get(str(val), str(val)) for val in values]

            data = {}
            name_val = answer_value("full_name")
            if name_val:
                data["full_name"] = name_val
            school_val = answer_value("school") or answer_value("school_name")
            if school_val:
                data["school"] = school_val
            else:
                school_id_val = answer_value("school_id")
                if school_id_val:
                    # Se o formulário enviou school_id, usamos o nome real da escola se existir.
                    data["school"] = card.student.school.name if card.student and card.student.school else school_id_val
            shift_val = answer_value("shift")
            if shift_val:
                if isinstance(shift_val, list):
                    allowed = {choice[0] for choice in Student.Shift.choices}
                    mapped = [Student.Shift(choice).label if choice in allowed else str(choice) for choice in shift_val]
                    data["shift"] = resolve_options(answer_map.get("shift"), mapped)
                else:
                    data["shift"] = shift_val
            course_val = answer_value("course")
            if course_val:
                data["course"] = resolve_options(answer_map.get("course"), course_val)
            if data:
                student_payload = data

        payload = {
            "valid": True,
            "reason": None,
            "card": {
                "card_number": card.card_number,
                "status": card.status,
                "expiration_date": card.expiration_date,
            },
            "student": student_payload,
        }
        return response.Response(payload)
