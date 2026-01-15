from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from destinations.models import Destination
from health.models import Patient, Companion
from students.models import School, ClassGroup, Student, StudentTransportRegistration
from tenants.models import Municipality


class HealthEducationCrudTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Cidade A",
            cnpj="00.000.000/0001-11",
            address="Rua A",
            city="Cidade A",
            state="SP",
            phone="11999999999",
        )
        self.muni_b = Municipality.objects.create(
            name="Cidade B",
            cnpj="00.000.000/0001-22",
            address="Rua B",
            city="Cidade B",
            state="SP",
            phone="11888888888",
        )
        self.admin_a = User.objects.create_user(
            email="admin-a@test.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin-b@test.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_b,
        )
        self.superadmin = User.objects.create_user(
            email="super@test.com",
            password="pass123",
            role=User.Roles.SUPERADMIN,
        )

    def _results(self, resp):
        data = resp.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_health_patient_crud_and_scoped_list(self):
        Patient.objects.create(
            municipality=self.muni_b,
            full_name="Paciente B",
            cpf="222.222.222-22",
            date_of_birth="1980-01-01",
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/healthcare/patients/",
            {
                "full_name": "Paciente A",
                "cpf": "111.111.111-11",
                "date_of_birth": "1990-05-10",
                "needs_companion": True,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        patient_id = create_resp.data["id"]

        list_resp = self.client.get("/api/healthcare/patients/")
        self.assertEqual(list_resp.status_code, 200)
        patients = self._results(list_resp)
        self.assertEqual(len(patients), 1)
        self.assertEqual(patients[0]["cpf"], "111.111.111-11")

        search_resp = self.client.get("/api/healthcare/patients/?search=111.111")
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(len(self._results(search_resp)), 1)

        patch_resp = self.client.patch(
            f"/api/healthcare/patients/{patient_id}/",
            {"status": "INACTIVE"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data["status"], "INACTIVE")

        delete_resp = self.client.delete(f"/api/healthcare/patients/{patient_id}/")
        self.assertEqual(delete_resp.status_code, 204)
        empty_resp = self.client.get("/api/healthcare/patients/")
        self.assertEqual(len(self._results(empty_resp)), 0)

    def test_health_companion_crud_and_filters(self):
        patient_a = Patient.objects.create(
            municipality=self.muni_a,
            full_name="Paciente A",
            cpf="333.333.333-33",
            date_of_birth="1970-02-02",
            needs_companion=True,
        )
        patient_b = Patient.objects.create(
            municipality=self.muni_b,
            full_name="Paciente B",
            cpf="444.444.444-44",
            date_of_birth="1985-03-03",
        )
        Companion.objects.create(
            municipality=self.muni_b,
            patient=patient_b,
            full_name="Companheiro B",
            cpf="555.555.555-55",
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/healthcare/companions/",
            {
                "patient": patient_a.id,
                "full_name": "Companheiro A",
                "cpf": "666.666.666-66",
                "active": True,
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        companion_id = create_resp.data["id"]

        list_resp = self.client.get(f"/api/healthcare/companions/?patient={patient_a.id}")
        self.assertEqual(list_resp.status_code, 200)
        companions = self._results(list_resp)
        self.assertEqual(len(companions), 1)
        self.assertEqual(companions[0]["full_name"], "Companheiro A")

        patch_resp = self.client.patch(
            f"/api/healthcare/companions/{companion_id}/",
            {"active": False},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        inactive_resp = self.client.get("/api/healthcare/companions/?active=true")
        self.assertEqual(len(self._results(inactive_resp)), 0)

        invalid_resp = self.client.post(
            "/api/healthcare/companions/",
            {"patient": patient_b.id, "full_name": "Companheiro X"},
            format="json",
        )
        self.assertEqual(invalid_resp.status_code, 400)

    def test_education_school_crud_and_destination_validation(self):
        dest_a = Destination.objects.create(
            municipality=self.muni_a,
            name="Destino A",
            type=Destination.DestinationType.SCHOOL,
            address="Rua 1",
            latitude=1,
            longitude=1,
        )
        dest_b = Destination.objects.create(
            municipality=self.muni_b,
            name="Destino B",
            type=Destination.DestinationType.SCHOOL,
            address="Rua 2",
            latitude=2,
            longitude=2,
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/students/schools/",
            {
                "name": "Escola A",
                "type": "MUNICIPAL",
                "destination": dest_a.id,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        school_id = create_resp.data["id"]

        list_resp = self.client.get("/api/students/schools/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(self._results(list_resp)), 1)

        invalid_patch = self.client.patch(
            f"/api/students/schools/{school_id}/",
            {"destination": dest_b.id},
            format="json",
        )
        self.assertEqual(invalid_patch.status_code, 400)

        patch_resp = self.client.patch(
            f"/api/students/schools/{school_id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertFalse(patch_resp.data["is_active"])

        delete_resp = self.client.delete(f"/api/students/schools/{school_id}/")
        self.assertEqual(delete_resp.status_code, 204)

    def test_education_class_group_and_student_crud(self):
        school_a = School.objects.create(
            municipality=self.muni_a,
            name="Escola A",
            address="Rua 1",
        )
        school_b = School.objects.create(
            municipality=self.muni_a,
            name="Escola B",
            address="Rua 2",
        )
        other_muni_school = School.objects.create(
            municipality=self.muni_b,
            name="Escola C",
            address="Rua 3",
        )
        class_b = ClassGroup.objects.create(
            municipality=self.muni_a,
            school=school_b,
            name="Turma B",
            shift="MORNING",
        )

        self.client.force_authenticate(self.admin_a)
        class_resp = self.client.post(
            "/api/students/class-groups/",
            {"school": school_a.id, "name": "Turma A", "shift": "AFTERNOON", "active": True},
            format="json",
        )
        self.assertEqual(class_resp.status_code, 201)
        class_id = class_resp.data["id"]

        invalid_class = self.client.post(
            "/api/students/class-groups/",
            {"school": other_muni_school.id, "name": "Turma X", "shift": "MORNING"},
            format="json",
        )
        self.assertEqual(invalid_class.status_code, 400)

        student_resp = self.client.post(
            "/api/students/students/",
            {
                "school": school_a.id,
                "class_group": class_id,
                "full_name": "Aluno A",
                "cpf": "777.777.777-77",
                "date_of_birth": "2010-02-02",
                "shift": "AFTERNOON",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(student_resp.status_code, 201)

        invalid_student = self.client.post(
            "/api/students/students/",
            {
                "school": school_a.id,
                "class_group": class_b.id,
                "full_name": "Aluno B",
                "cpf": "888.888.888-88",
                "date_of_birth": "2011-03-03",
                "shift": "MORNING",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(invalid_student.status_code, 400)

        students_resp = self.client.get("/api/students/students/")
        self.assertEqual(students_resp.status_code, 200)
        self.assertEqual(len(self._results(students_resp)), 1)

    def test_transport_registration_crud_and_scoping(self):
        school_a = School.objects.create(
            municipality=self.muni_a,
            name="Escola A",
            address="Rua A",
        )
        student_a = Student.objects.create(
            municipality=self.muni_a,
            school=school_a,
            full_name="Aluno A",
            cpf="999.999.999-99",
            date_of_birth="2012-04-04",
        )
        student_b = Student.objects.create(
            municipality=self.muni_b,
            school=School.objects.create(municipality=self.muni_b, name="Escola B", address="Rua B"),
            full_name="Aluno B",
            cpf="101.101.101-10",
            date_of_birth="2011-05-05",
        )
        StudentTransportRegistration.objects.create(
            municipality=self.muni_b,
            student=student_b,
            school=student_b.school,
            pickup_address="Rua X",
            dropoff_address="Rua Y",
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/students/transport-registrations/",
            {
                "student": student_a.id,
                "school": school_a.id,
                "pickup_address": "Rua 1",
                "dropoff_address": "Rua 2",
                "shift": "MORNING",
                "days_of_week": ["MON", "TUE"],
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)

        invalid_resp = self.client.post(
            "/api/students/transport-registrations/",
            {
                "student": student_b.id,
                "school": student_b.school.id,
                "pickup_address": "Rua 3",
                "dropoff_address": "Rua 4",
            },
            format="json",
        )
        self.assertEqual(invalid_resp.status_code, 400)

        list_resp = self.client.get("/api/students/transport-registrations/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(self._results(list_resp)), 1)
