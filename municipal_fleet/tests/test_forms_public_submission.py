from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from forms.models import FormTemplate, FormQuestion, FormOption, FormSubmission
from tenants.models import Municipality


class PublicFormSubmissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.municipality = Municipality.objects.create(
            name="Cidade Formulário",
            cnpj="44.444.444/0001-44",
            address="Rua Teste",
            city="Cidade",
            state="SP",
            phone="11988887777",
        )
        self.admin = User.objects.create_user(
            email="admin@forms.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.municipality,
        )
        self.template = FormTemplate.objects.create(
            municipality=self.municipality,
            name="Formulário Público",
            slug="form-publico",
            form_type=FormTemplate.FormType.GENERIC,
            is_active=True,
        )
        self.cpf_question = FormQuestion.objects.create(
            form_template=self.template,
            order=1,
            label="CPF",
            field_name="cpf",
            type=FormQuestion.QuestionType.SHORT_TEXT,
            required=True,
        )
        self.reason_question = FormQuestion.objects.create(
            form_template=self.template,
            order=2,
            label="Motivo",
            field_name="reason",
            type=FormQuestion.QuestionType.LONG_TEXT,
            required=False,
        )
        self.checkbox_question = FormQuestion.objects.create(
            form_template=self.template,
            order=3,
            label="Áreas",
            field_name="topics",
            type=FormQuestion.QuestionType.CHECKBOXES,
            required=False,
        )
        FormOption.objects.create(question=self.checkbox_question, label="Opção A", value="A", order=1)
        FormOption.objects.create(question=self.checkbox_question, label="Opção B", value="B", order=2)
        self.file_question = FormQuestion.objects.create(
            form_template=self.template,
            order=4,
            label="Documento",
            field_name="document",
            type=FormQuestion.QuestionType.FILE_UPLOAD,
            required=True,
        )

    def _submit_form(self, payload=None, files=None):
        payload = payload or {}
        files = files or {}
        return self.client.post(
            f"/public/forms/{self.template.slug}/submit/",
            data={**payload, **files},
            format="multipart",
        )

    def test_public_submission_requires_cpf_value(self):
        pdf = SimpleUploadedFile("doc.pdf", b"filecontent", content_type="application/pdf")
        resp = self._submit_form(
            payload={"reason": "Teste", "topics": '["A"]'},
            files={"document": pdf},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("cpf", resp.data)

    def test_public_submission_requires_file_upload(self):
        resp = self._submit_form(payload={"cpf": "12345678900", "topics": '["A"]'})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("document", resp.data)

    def test_public_submission_accepts_checkbox_json_and_persists_answers(self):
        pdf = SimpleUploadedFile("doc.pdf", b"filecontent", content_type="application/pdf")
        resp = self._submit_form(
            payload={"cpf": "12345678900", "reason": "Detalhes", "topics": '["A","B"]'},
            files={"document": pdf},
        )
        self.assertEqual(resp.status_code, 201)
        protocol = resp.data["protocol_number"]
        submission = FormSubmission.objects.get(protocol_number=protocol)
        self.assertEqual(submission.cpf, "12345678900")
        answers = {a.question_id: a for a in submission.answers.all()}
        self.assertEqual(len(answers), 4)
        self.assertEqual(answers[self.cpf_question.id].value_text, "12345678900")
        self.assertEqual(answers[self.reason_question.id].value_text, "Detalhes")
        self.assertEqual(answers[self.checkbox_question.id].value_json, ["A", "B"])
        file_name = answers[self.file_question.id].file.name
        self.assertIn("form_submissions", file_name)
        self.assertTrue(file_name.endswith(".pdf"))

    def test_municipality_admin_can_create_template_and_review_submissions(self):
        # admin municipal consegue criar formulário e gerenciar submissões do seu município
        self.client.force_authenticate(self.admin)
        create_resp = self.client.post(
            "/api/forms/templates/",
            {
                "name": "Novo Formulário",
                "slug": "",
                "description": "Criado pelo admin municipal",
                "form_type": FormTemplate.FormType.GENERIC,
                "require_cpf": False,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        self.assertEqual(create_resp.data["municipality"], self.municipality.id)

        submission = self._submit_form(payload={"cpf": "98765432100", "topics": '["A"]'}, files={"document": SimpleUploadedFile("doc.pdf", b"x", content_type="application/pdf")})
        self.assertEqual(submission.status_code, 201)
        list_resp = self.client.get("/api/forms/submissions/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertGreaterEqual(list_resp.data["count"], 1)
        sub_id = list_resp.data["results"][0]["id"]
        review_resp = self.client.patch(
            f"/api/forms/submissions/{sub_id}/review/",
            {"status": FormSubmission.Status.REJECTED, "status_notes": "Teste"},
            format="json",
        )
        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(review_resp.data["status"], FormSubmission.Status.REJECTED)

    def test_admin_endpoints_require_authentication(self):
        # público não autenticado recebe 401 nas rotas protegidas
        resp = self.client.get("/api/forms/templates/")
        self.assertEqual(resp.status_code, 401)
        resp = self.client.get("/api/forms/submissions/")
        self.assertEqual(resp.status_code, 401)

        # admins autenticados conseguem listar templates e submissões
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/forms/templates/")
        self.assertEqual(resp.status_code, 200)
        resp = self.client.get("/api/forms/submissions/")
        self.assertEqual(resp.status_code, 200)
