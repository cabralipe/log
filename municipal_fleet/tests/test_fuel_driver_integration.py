from django.test import TestCase
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drivers.models import Driver
from drivers.portal import generate_portal_token
from fleet.models import FuelStation, Vehicle
from tenants.models import Municipality


class FuelDriverIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.municipality = Municipality.objects.create(
            name="Cidade Teste",
            cnpj="33.333.333/0001-33",
            address="Rua A",
            city="Cidade",
            state="SP",
            phone="11999999999",
        )
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.municipality,
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
        self.vehicle = Vehicle.objects.create(
            municipality=self.municipality,
            license_plate="AAA1234",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        self.station = FuelStation.objects.create(
            municipality=self.municipality,
            name="Posto A",
            cnpj="00.000.000/0001-44",
            address="Rua A",
            active=True,
        )
        self.token = generate_portal_token(self.driver)

    def test_portal_fuel_log_updates_vehicle_and_reports(self):
        payload = {
            "vehicle": self.vehicle.id,
            "liters": "50.00",
            "price_per_liter": "5.10",
            "fuel_station_id": self.station.id,
            "filled_at": timezone.localdate().isoformat(),
            "odometer": 1050,
        }
        portal_resp = self.client.post(
            "/api/drivers/portal/fuel_logs/",
            payload,
            format="json",
            HTTP_X_DRIVER_TOKEN=self.token,
        )
        self.assertEqual(portal_resp.status_code, 201, portal_resp.data)

        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.odometer_current, 1050)

        self.client.force_authenticate(self.admin)
        list_resp = self.client.get("/api/vehicles/fuel_logs/")
        self.assertEqual(list_resp.status_code, 200)
        logs = list_resp.data["results"] if isinstance(list_resp.data, dict) else list_resp.data
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["fuel_station"], "Posto A")

        report_resp = self.client.get(
            "/api/reports/fuel/",
            {"start_date": timezone.localdate().isoformat(), "end_date": timezone.localdate().isoformat()},
        )
        self.assertEqual(report_resp.status_code, 200)
        self.assertEqual(Decimal(str(report_resp.data["summary"]["total_liters"])), Decimal("50"))

    def test_portal_fuel_log_rejects_lower_odometer(self):
        payload = {
            "vehicle": self.vehicle.id,
            "liters": "10.00",
            "price_per_liter": "5.10",
            "fuel_station_id": self.station.id,
            "filled_at": timezone.localdate().isoformat(),
            "odometer": 900,
        }
        portal_resp = self.client.post(
            "/api/drivers/portal/fuel_logs/",
            payload,
            format="json",
            HTTP_X_DRIVER_TOKEN=self.token,
        )
        self.assertEqual(portal_resp.status_code, 400)
