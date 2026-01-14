from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from destinations.models import Destination
from drivers.models import Driver
from fleet.models import Vehicle
from students.models import School, Student
from tenants.models import Municipality


class SchoolTransportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.municipality = Municipality.objects.create(
            name="Cidade Teste",
            cnpj="00.000.000/0001-00",
            address="Rua A",
            city="Cidade",
            state="SP",
            phone="11999999999",
        )
        self.superuser = User.objects.create_user(
            email="admin@example.com", password="pass123", role=User.Roles.SUPERADMIN
        )
        self.client.force_authenticate(self.superuser)
        self.vehicle = Vehicle.objects.create(
            municipality=self.municipality,
            license_plate="ABC1234",
            model="Onibus",
            brand="Ford",
            year=2020,
            max_passengers=40,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        self.driver = Driver.objects.create(
            municipality=self.municipality,
            name="Motorista",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )

    def _make_destination(self, name, latitude, longitude):
        return Destination.objects.create(
            municipality=self.municipality,
            name=name,
            type=Destination.DestinationType.SCHOOL,
            address="Rua da Escola",
            number="123",
            district="Centro",
            city="Cidade",
            state="SP",
            postal_code="00000-000",
            latitude=latitude,
            longitude=longitude,
        )

    def _make_student(self, school):
        return Student.objects.create(
            municipality=self.municipality,
            school=school,
            full_name="Aluno 1",
            date_of_birth="2010-01-01",
            cpf="123.456.789-00",
            registration_number="123",
            grade="5",
            shift=Student.Shift.MORNING,
            address="Rua A",
            district="Centro",
            has_special_needs=True,
            special_needs_details="TEA",
        )

    def _create_execution(self, destination_ids, student_id):
        departure = timezone.now()
        payload = {
            "module": "EDUCATION",
            "vehicle": self.vehicle.id,
            "driver": self.driver.id,
            "scheduled_departure": departure.isoformat(),
            "scheduled_return": (departure + timedelta(hours=1)).isoformat(),
            "planned_capacity": self.vehicle.max_passengers,
            "stops": [
                {"destination": dest_id, "order": idx + 1}
                for idx, dest_id in enumerate(destination_ids)
            ],
            "manifest": {
                "passengers": [
                    {
                        "passenger_type": "STUDENT",
                        "student": student_id,
                    }
                ]
            },
        }
        return self.client.post("/api/trips/executions/", payload, format="json")

    def test_execution_rejects_student_outside_route(self):
        school_dest = self._make_destination("Escola A", -23.0, -46.0)
        other_dest = self._make_destination("Escola B", -23.1, -46.1)
        school = School.objects.create(
            municipality=self.municipality,
            name="Escola A",
            address="Rua A",
            city="Cidade",
            district="Centro",
            destination=school_dest,
        )
        student = self._make_student(school)

        resp = self._create_execution([other_dest.id], student.id)
        self.assertEqual(resp.status_code, 400)

    def test_itinerary_and_dashboard_include_students(self):
        school_dest = self._make_destination("Escola A", -23.0, -46.0)
        school = School.objects.create(
            municipality=self.municipality,
            name="Escola A",
            address="Rua A",
            city="Cidade",
            district="Centro",
            destination=school_dest,
        )
        student = self._make_student(school)

        resp = self._create_execution([school_dest.id], student.id)
        self.assertEqual(resp.status_code, 201)
        execution_id = resp.data["id"]

        itinerary = self.client.get(f"/api/trips/executions/{execution_id}/itinerary/")
        self.assertEqual(itinerary.status_code, 200)
        self.assertTrue(any(p["student"] == student.id for p in itinerary.data["passengers"]))

        dashboard = self.client.get("/api/trips/school-monitor/")
        self.assertEqual(dashboard.status_code, 200)
        executions = dashboard.data["executions"]
        self.assertTrue(executions)
        students = executions[0]["students"]
        self.assertTrue(any(s["student_id"] == student.id for s in students))
