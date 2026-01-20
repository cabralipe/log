from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drivers.models import Driver
from fleet.models import Vehicle
from tenants.models import Municipality
from trips.models import FreeTrip, Trip, TripGpsPing


class FreeTripActionsTests(TestCase):
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

    def test_free_trip_summary_and_incidents(self):
        open_trip = FreeTrip.objects.create(
            municipality=self.muni,
            driver=self.driver,
            vehicle=self.vehicle,
            odometer_start=1000,
        )
        FreeTrip.objects.create(
            municipality=self.muni,
            driver=self.driver,
            vehicle=self.vehicle,
            status=FreeTrip.Status.CLOSED,
            odometer_start=900,
            odometer_end=950,
            ended_at=timezone.now(),
        )

        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/trips/free-trips/summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["open_count"], 1)
        self.assertEqual(resp.data["open_trips"][0]["id"], open_trip.id)

        resp = self.client.get(f"/api/trips/free-trips/{open_trip.id}/incidents/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

        resp = self.client.post(
            f"/api/trips/free-trips/{open_trip.id}/incidents/",
            {"free_trip": open_trip.id, "description": "Pneu furou"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["description"], "Pneu furou")

        resp = self.client.get(f"/api/trips/free-trips/{open_trip.id}/incidents/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)


class TripMapStateTests(TestCase):
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
        self.viewer = User.objects.create_user(
            email="viewer@b.com",
            password="pass123",
            role=User.Roles.VIEWER,
            municipality=self.muni,
        )
        self.driver = Driver.objects.create(
            municipality=self.muni,
            name="Motorista",
            cpf="222.222.222-22",
            cnh_number="54321",
            cnh_category="B",
            cnh_expiration_date="2030-01-01",
            phone="11888888888",
        )
        self.vehicle = Vehicle.objects.create(
            municipality=self.muni,
            license_plate="BBB1234",
            model="Carro",
            brand="VW",
            year=2020,
            max_passengers=4,
            odometer_current=2000,
            odometer_initial=1500,
            odometer_monthly_limit=3000,
        )
        trip = Trip.objects.create(
            municipality=self.muni,
            vehicle=self.vehicle,
            driver=self.driver,
            origin="A",
            destination="B",
            departure_datetime=timezone.now(),
            return_datetime_expected=timezone.now() + timezone.timedelta(hours=1),
            odometer_start=2000,
            passengers_count=1,
            status=Trip.Status.IN_PROGRESS,
        )
        TripGpsPing.objects.create(
            trip=trip,
            driver=self.driver,
            lat="-23.550520",
            lng="-46.633308",
            accuracy=5.0,
            speed=30.0,
            recorded_at=timezone.now(),
        )

    def test_map_state_requires_privileged_role(self):
        self.client.force_authenticate(self.viewer)
        resp = self.client.get("/api/trips/map-state/")
        self.assertEqual(resp.status_code, 403)

    def test_map_state_hides_history_when_disabled(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/trips/map-state/?include_history=false")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["drivers"]), 1)
        self.assertEqual(resp.data["drivers"][0]["history"], [])
