from django.test import TestCase
from rest_framework.test import APIClient
from tenants.models import Municipality
from accounts.models import User
from forms.models import FormTemplate, FormQuestion, FormSubmission
from students.models import School, StudentCard


class StudentCardFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.municipality = Municipality.objects.create(
            name="Cidade Teste",
            cnpj="99.999.999/0001-99",
            address="Rua Um",
            city="Cidade",
            state="SP",
            phone="11999990000",
        )
        self.admin = User.objects.create_user(
            email="admin@test.com", password="pass123", role=User.Roles.ADMIN_MUNICIPALITY, municipality=self.municipality
        )
        self.template = FormTemplate.objects.create(
            municipality=self.municipality,
            name="Carteirinha 2025",
            slug="carteirinha-2025",
            form_type=FormTemplate.FormType.STUDENT_CARD_APPLICATION,
            is_active=True,
        )
        self.school = School.objects.create(
            municipality=self.municipality, name="Escola Municipal X", address="Rua A", city="Cidade", district="Centro"
        )
        FormQuestion.objects.create(
            form_template=self.template,
            order=1,
            label="CPF",
            field_name="cpf",
            type=FormQuestion.QuestionType.SHORT_TEXT,
            required=True,
        )
        FormQuestion.objects.create(
            form_template=self.template,
            order=2,
            label="Nome Completo",
            field_name="full_name",
            type=FormQuestion.QuestionType.SHORT_TEXT,
            required=True,
        )
        FormQuestion.objects.create(
            form_template=self.template,
            order=3,
            label="Escola",
            field_name="school_id",
            type=FormQuestion.QuestionType.DROPDOWN,
            required=True,
        )

    def _submit_public(self, cpf="12345678900"):
        payload = {"cpf": cpf, "full_name": "Fulano de Tal", "school_id": self.school.id}
        resp = self.client.post(f"/public/forms/{self.template.slug}/submit/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        protocol = resp.data["protocol_number"]
        return FormSubmission.objects.get(protocol_number=protocol)

    def test_cpf_question_must_be_required(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            "/api/forms/questions/",
            {
                "form_template": self.template.id,
                "order": 4,
                "label": "CPF Novo",
                "field_name": "cpf",
                "type": FormQuestion.QuestionType.SHORT_TEXT,
                "required": False,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_public_submission_and_status(self):
        submission = self._submit_public()
        resp = self.client.get(f"/public/forms/{self.template.slug}/status/?cpf={submission.cpf}")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data["submissions"]), 1)
        self.assertEqual(resp.data["submissions"][0]["status"], FormSubmission.Status.PENDING)

    def test_approval_creates_student_and_card_and_validates_qr(self):
        submission = self._submit_public("32165498700")
        self.client.force_authenticate(self.admin)
        resp = self.client.patch(
            f"/api/forms/submissions/{submission.id}/review/",
            {"status": FormSubmission.Status.APPROVED},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        submission.refresh_from_db()
        self.assertEqual(submission.status, FormSubmission.Status.APPROVED)
        self.assertIsNotNone(submission.linked_student)
        self.assertIsNotNone(submission.linked_student_card)
        card = submission.linked_student_card
        self.assertEqual(card.status, StudentCard.Status.ACTIVE)

        resp = self.client.get(f"/api/students/student-cards/validate/?payload={card.qr_payload}")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["valid"])
        self.assertEqual(resp.data["card"]["card_number"], card.card_number)

        status_resp = self.client.get(f"/public/forms/{self.template.slug}/status/?cpf={submission.cpf}")
        self.assertEqual(status_resp.status_code, 200)
        self.assertIsNotNone(status_resp.data["submissions"][0].get("card"))

    def test_needs_correction_status(self):
        submission = self._submit_public("55544433322")
        self.client.force_authenticate(self.admin)
        resp = self.client.patch(
            f"/api/forms/submissions/{submission.id}/review/",
            {"status": FormSubmission.Status.NEEDS_CORRECTION, "status_notes": "Enviar RG legível"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        submission.refresh_from_db()
        self.assertEqual(submission.status, FormSubmission.Status.NEEDS_CORRECTION)
        self.assertEqual(submission.status_notes, "Enviar RG legível")

    def test_reject_after_approved_blocks_card_and_qr(self):
        submission = self._submit_public("77711122233")
        self.client.force_authenticate(self.admin)
        approve_resp = self.client.patch(
            f"/api/forms/submissions/{submission.id}/review/",
            {"status": FormSubmission.Status.APPROVED},
            format="json",
        )
        self.assertEqual(approve_resp.status_code, 200)
        submission.refresh_from_db()
        card = submission.linked_student_card
        self.assertIsNotNone(card)

        reject_resp = self.client.patch(
            f"/api/forms/submissions/{submission.id}/review/",
            {"status": FormSubmission.Status.REJECTED, "status_notes": "Docs inválidos"},
            format="json",
        )
        self.assertEqual(reject_resp.status_code, 200)
        card.refresh_from_db()
        self.assertEqual(card.status, StudentCard.Status.BLOCKED)
        submission.refresh_from_db()
        self.assertEqual(submission.linked_student_card_id, card.id)

        validate_resp = self.client.get(f"/api/students/student-cards/validate/?payload={card.qr_payload}")
        self.assertEqual(validate_resp.status_code, 200)
        self.assertFalse(validate_resp.data["valid"])
        self.assertEqual(validate_resp.data["reason"], FormSubmission.Status.REJECTED)
