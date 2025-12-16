from django.utils import timezone
from rest_framework import viewsets, permissions, exceptions, response, status
from rest_framework.views import APIView
from tenants.mixins import MunicipalityQuerysetMixin
from accounts.permissions import IsMunicipalityAdminOrReadOnly, IsMunicipalityAdmin
from students.models import School, Student, StudentCard, StudentTransportRegistration
from forms.models import FormSubmission
from students.serializers import (
    SchoolSerializer,
    StudentSerializer,
    StudentCardSerializer,
    StudentTransportRegistrationSerializer,
)


class BaseMunicipalityCreateMixin:
    """
    Helper to enforce municipality scoping on create.
    """

    def get_municipality(self, serializer):
        user = self.request.user
        if user.role == "SUPERADMIN":
            return serializer.validated_data.get("municipality")
        return user.municipality


class SchoolViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = School.objects.select_related("municipality")
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]

    def perform_create(self, serializer):
        municipality = self.get_municipality(serializer)
        serializer.save(municipality=municipality)


class StudentViewSet(BaseMunicipalityCreateMixin, MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Student.objects.select_related("municipality", "school")
    serializer_class = StudentSerializer
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


class StudentCardValidateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
        today = timezone.localdate()
        if card.status != StudentCard.Status.ACTIVE:
            return response.Response({"valid": False, "reason": card.status})
        if card.expiration_date and card.expiration_date < today:
            return response.Response({"valid": False, "reason": "CARD_EXPIRED"})

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
