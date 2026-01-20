from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drivers.models import Driver
from fleet.models import Vehicle
from tenants.models import Municipality
from trips.models import PlannedTrip


class PlannedTripGenerateExecutionsTests(TestCase):
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
        self.driver = Driver.objects.create(
            municipality=self.muni,
            name="Motorista",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )
        self.vehicle = Vehicle.objects.create(
            municipality=self.muni,
            license_plate="AAA1234",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        self.plan_missing_resources = PlannedTrip.objects.create(
            municipality=self.muni,
            title="Plano sem recursos",
            module=PlannedTrip.Module.OTHER,
            start_date=timezone.localdate(),
            departure_time=timezone.datetime(2024, 1, 1, 8, 0).time(),
            return_time_expected=timezone.datetime(2024, 1, 1, 9, 0).time(),
        )
        self.plan_ready = PlannedTrip.objects.create(
            municipality=self.muni,
            title="Plano com recursos",
            module=PlannedTrip.Module.OTHER,
            vehicle=self.vehicle,
            driver=self.driver,
            start_date=timezone.localdate(),
            departure_time=timezone.datetime(2024, 1, 1, 8, 0).time(),
            return_time_expected=timezone.datetime(2024, 1, 1, 9, 0).time(),
        )

    def test_generate_executions_requires_dates(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            f"/api/trips/planned/{self.plan_ready.id}/generate-executions/",
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_generate_executions_rejects_invalid_dates(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            f"/api/trips/planned/{self.plan_ready.id}/generate-executions/",
            {"start_date": "2024-99-99", "end_date": "2024-01-01"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_generate_executions_requires_vehicle_and_driver(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            f"/api/trips/planned/{self.plan_missing_resources.id}/generate-executions/",
            {"start_date": "2024-01-01", "end_date": "2024-01-02"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
