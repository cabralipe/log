from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.utils import timezone

from tenants.models import Municipality
from accounts.models import User
from fleet.models import Vehicle
from drivers.models import Driver
from trips.models import Trip


class APISmokeTests(TestCase):
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

    def test_create_user(self):
        resp = self.client.post(
            "/api/auth/users/",
            {
                "email": "op@example.com",
                "password": "pass123",
                "role": User.Roles.ADMIN_MUNICIPALITY,
                "municipality": self.municipality.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)

    def test_vehicle_and_trip_validation(self):
        vehicle = Vehicle.objects.create(
            municipality=self.municipality,
            license_plate="ABC1234",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        driver = Driver.objects.create(
            municipality=self.municipality,
            name="Motorista",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )
        # capacity validation
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": vehicle.id,
                "driver": driver.id,
                "municipality": self.municipality.id,
                "origin": "A",
                "destination": "B",
                "departure_datetime": timezone.now(),
                "return_datetime_expected": timezone.now(),
                "odometer_start": 1000,
                "passengers_count": 20,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        # return after departure validation
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": vehicle.id,
                "driver": driver.id,
                "municipality": self.municipality.id,
                "origin": "A",
                "destination": "B",
                "departure_datetime": "2030-01-01T10:00:00Z",
                "return_datetime_expected": "2030-01-01T09:00:00Z",
                "odometer_start": 1000,
                "passengers_count": 4,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_whatsapp_message(self):
        vehicle = Vehicle.objects.create(
            municipality=self.municipality,
            license_plate="XYZ1234",
            model="Carro",
            brand="VW",
            year=2019,
            max_passengers=4,
            odometer_current=100,
            odometer_initial=50,
            odometer_monthly_limit=500,
        )
        driver = Driver.objects.create(
            municipality=self.municipality,
            name="Joao",
            cpf="222.222.222-22",
            cnh_number="54321",
            cnh_category="B",
            cnh_expiration_date="2030-01-01",
            phone="+55 (11) 98888-7777",
        )
        trip = Trip.objects.create(
            municipality=self.municipality,
            vehicle=vehicle,
            driver=driver,
            origin="Centro",
            destination="Bairro",
            departure_datetime=timezone.now(),
            return_datetime_expected=timezone.now(),
            odometer_start=100,
            passengers_count=2,
        )
        resp = self.client.get(f"/api/trips/{trip.id}/whatsapp_message/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("wa.me", resp.data["wa_link"])
