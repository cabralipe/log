from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drivers.models import Driver
from fleet.models import Vehicle
from forms.models import FormTemplate, FormSubmission
from tenants.models import Municipality
from transport_planning.models import (
    Person,
    Route,
    ServiceApplication,
    TransportService,
)


class RouteStopsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni = Municipality.objects.create(
            name="Pref A",
            cnpj="11.111.111/0001-11",
            address="Rua 1",
            city="Cidade",
            state="SP",
            phone="11999990000",
        )
        self.admin = User.objects.create_user(
            email="admin@a.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni,
        )
        self.service = TransportService.objects.create(
            municipality=self.muni,
            name="Transporte Escolar",
            service_type=TransportService.ServiceType.SCHEDULED,
        )
        self.route = Route.objects.create(
            municipality=self.muni,
            transport_service=self.service,
            code="R1",
            name="Rota 1",
        )

    def test_route_stops_create_and_list(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            f"/api/routes/{self.route.id}/stops/",
            {"route": self.route.id, "order": 1, "description": "Ponto A", "stop_type": "PICKUP"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["route"], self.route.id)
        self.assertEqual(resp.data["municipality"], self.muni.id)

        resp = self.client.get(f"/api/routes/{self.route.id}/stops/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["description"], "Ponto A")


class ServiceApplicationReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni = Municipality.objects.create(
            name="Pref B",
            cnpj="22.222.222/0001-22",
            address="Rua 2",
            city="Cidade",
            state="SP",
            phone="11888880000",
        )
        self.admin = User.objects.create_user(
            email="admin@b.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni,
        )
        self.template = FormTemplate.objects.create(
            municipality=self.muni,
            name="Formulario Transporte",
            form_type=FormTemplate.FormType.TRANSPORT_REQUEST,
        )
        self.submission = FormSubmission.objects.create(
            form_template=self.template,
            municipality=self.muni,
        )
        self.person = Person.objects.create(
            municipality=self.muni,
            full_name="Ana Pessoa",
            cpf="123.456.789-00",
        )
        self.service = TransportService.objects.create(
            municipality=self.muni,
            name="Transporte Saude",
            service_type=TransportService.ServiceType.ON_DEMAND,
            form_template=self.template,
        )
        self.application = ServiceApplication.objects.create(
            municipality=self.muni,
            person=self.person,
            transport_service=self.service,
            form_submission=self.submission,
        )

    def test_review_rejects_invalid_status(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.patch(
            f"/api/service-applications/{self.application.id}/review/",
            {"status": "INVALID"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_review_updates_status_and_notes(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.patch(
            f"/api/service-applications/{self.application.id}/review/",
            {"status": ServiceApplication.Status.APPROVED, "status_notes": "OK"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], ServiceApplication.Status.APPROVED)
        self.assertEqual(resp.data["status_notes"], "OK")


class AssignmentSuggestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Pref C",
            cnpj="33.333.333/0001-33",
            address="Rua 3",
            city="Cidade",
            state="SP",
            phone="11777770000",
        )
        self.muni_b = Municipality.objects.create(
            name="Pref D",
            cnpj="44.444.444/0001-44",
            address="Rua 4",
            city="Cidade",
            state="SP",
            phone="11666660000",
        )
        self.admin_a = User.objects.create_user(
            email="admin@c.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin@d.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_b,
        )
        self.service_a = TransportService.objects.create(
            municipality=self.muni_a,
            name="Transporte A",
            service_type=TransportService.ServiceType.SCHEDULED,
        )
        self.route_a = Route.objects.create(
            municipality=self.muni_a,
            transport_service=self.service_a,
            code="R-A",
            name="Rota A",
            time_window_start=timezone.datetime(2024, 1, 1, 8, 0).time(),
            time_window_end=timezone.datetime(2024, 1, 1, 10, 0).time(),
            planned_capacity=4,
        )
        self.route_b = Route.objects.create(
            municipality=self.muni_b,
            transport_service=TransportService.objects.create(
                municipality=self.muni_b,
                name="Transporte B",
                service_type=TransportService.ServiceType.SCHEDULED,
            ),
            code="R-B",
            name="Rota B",
        )
        self.vehicle_ok = Vehicle.objects.create(
            municipality=self.muni_a,
            license_plate="AAA1234",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=5,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        self.vehicle_small = Vehicle.objects.create(
            municipality=self.muni_a,
            license_plate="BBB1234",
            model="Carro",
            brand="VW",
            year=2020,
            max_passengers=2,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        self.driver_ok = Driver.objects.create(
            municipality=self.muni_a,
            name="Motorista",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )
        self.route_a.preferred_vehicles.add(self.vehicle_ok)
        self.route_a.preferred_drivers.add(self.driver_ok)

    def test_suggest_requires_params(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get("/api/assignments/suggest/")
        self.assertEqual(resp.status_code, 400)

    def test_suggest_rejects_other_municipality_route(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get(f"/api/assignments/suggest/?route_id={self.route_b.id}&date=2024-01-01")
        self.assertEqual(resp.status_code, 403)

    def test_suggest_returns_available_resources(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get(f"/api/assignments/suggest/?route_id={self.route_a.id}&date=2024-01-01")
        self.assertEqual(resp.status_code, 200)
        vehicles = resp.data["vehicles"]
        drivers = resp.data["drivers"]
        self.assertEqual(len(vehicles), 1)
        self.assertEqual(vehicles[0]["id"], self.vehicle_ok.id)
        self.assertTrue(vehicles[0]["preferred"])
        self.assertEqual(len(drivers), 1)
        self.assertEqual(drivers[0]["id"], self.driver_ok.id)
        self.assertTrue(drivers[0]["preferred"])
