from django.test import TestCase
from rest_framework.test import APIClient
from tenants.models import Municipality
from accounts.models import User
from fleet.models import Vehicle
from drivers.models import Driver
from django.utils import timezone
from trips.models import Trip


class UserPermissionTests(TestCase):
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
            email="admin@a.com", password="pass123", role=User.Roles.ADMIN_MUNICIPALITY, municipality=self.muni
        )
        self.viewer = User.objects.create_user(
            email="viewer@a.com", password="pass123", role=User.Roles.VIEWER, municipality=self.muni
        )

    def test_list_users_requires_admin(self):
        self.client.force_authenticate(self.viewer)
        resp = self.client.get("/api/auth/users/")
        self.assertEqual(resp.status_code, 403)

        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/auth/users/")
        self.assertEqual(resp.status_code, 200)

    def test_retrieve_self_allowed(self):
        self.client.force_authenticate(self.viewer)
        resp = self.client.get(f"/api/auth/users/{self.viewer.id}/")
        self.assertEqual(resp.status_code, 200)


class FleetPermissionTests(TestCase):
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
            email="admin@b.com", password="pass123", role=User.Roles.ADMIN_MUNICIPALITY, municipality=self.muni
        )
        self.viewer = User.objects.create_user(
            email="viewer@b.com", password="pass123", role=User.Roles.VIEWER, municipality=self.muni
        )

    def test_create_vehicle_only_admin(self):
        payload = {
            "municipality": self.muni.id,
            "license_plate": "AAA1234",
            "model": "Van",
            "brand": "Ford",
            "year": 2020,
            "max_passengers": 10,
            "odometer_current": 1000,
            "odometer_initial": 900,
            "odometer_monthly_limit": 2000,
        }
        self.client.force_authenticate(self.viewer)
        resp = self.client.post("/api/vehicles/", payload, format="json")
        self.assertEqual(resp.status_code, 403)

        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/vehicles/", payload, format="json")
        self.assertEqual(resp.status_code, 201)


class TripBusinessRulesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni = Municipality.objects.create(
            name="Pref C",
            cnpj="33.333.333/0001-33",
            address="Rua 3",
            city="Cidade",
            state="SP",
            phone="11777770000",
        )
        self.admin = User.objects.create_user(
            email="admin@c.com", password="pass123", role=User.Roles.ADMIN_MUNICIPALITY, municipality=self.muni
        )
        self.vehicle = Vehicle.objects.create(
            municipality=self.muni,
            license_plate="CCC1234",
            model="Micro",
            brand="VW",
            year=2021,
            max_passengers=5,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=1000,
        )
        self.driver = Driver.objects.create(
            municipality=self.muni,
            name="Driver C",
            cpf="333.333.333-33",
            cnh_number="33333",
            cnh_category="B",
            cnh_expiration_date="2030-01-01",
            phone="11666660000",
        )
        self.client.force_authenticate(self.admin)

    def test_trip_conflict(self):
        now = timezone.now()
        Trip.objects.create(
            municipality=self.muni,
            vehicle=self.vehicle,
            driver=self.driver,
            origin="A",
            destination="B",
            departure_datetime=now,
            return_datetime_expected=now + timezone.timedelta(hours=2),
            odometer_start=1000,
            passengers_count=4,
        )
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": self.vehicle.id,
                "driver": self.driver.id,
                "municipality": self.muni.id,
                "origin": "C",
                "destination": "D",
                "departure_datetime": now + timezone.timedelta(minutes=30),
                "return_datetime_expected": now + timezone.timedelta(hours=3),
                "odometer_start": 1005,
                "passengers_count": 3,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
