from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drivers.models import Driver
from fleet.models import Vehicle
from tenants.models import Municipality
from trips.models import Trip


class TripReportViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Pref A",
            cnpj="11.111.111/0001-11",
            address="Rua 1",
            city="Cidade",
            state="SP",
            phone="11999990000",
        )
        self.muni_b = Municipality.objects.create(
            name="Pref B",
            cnpj="22.222.222/0001-22",
            address="Rua 2",
            city="Cidade",
            state="SP",
            phone="11888880000",
        )
        self.admin_a = User.objects.create_user(
            email="admin@a.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.superadmin = User.objects.create_user(
            email="root@example.com",
            password="pass123",
            role=User.Roles.SUPERADMIN,
        )
        self.vehicle_a = Vehicle.objects.create(
            municipality=self.muni_a,
            license_plate="AAA1234",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )
        self.driver_a = Driver.objects.create(
            municipality=self.muni_a,
            name="Motorista A",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )
        self.vehicle_b = Vehicle.objects.create(
            municipality=self.muni_b,
            license_plate="BBB1234",
            model="Carro",
            brand="VW",
            year=2020,
            max_passengers=4,
            odometer_current=2000,
            odometer_initial=1500,
            odometer_monthly_limit=3000,
        )
        self.driver_b = Driver.objects.create(
            municipality=self.muni_b,
            name="Motorista B",
            cpf="222.222.222-22",
            cnh_number="54321",
            cnh_category="B",
            cnh_expiration_date="2030-01-01",
            phone="11888888888",
        )
        base_date = timezone.datetime(2024, 1, 10, 9, 0, tzinfo=timezone.get_current_timezone())
        Trip.objects.create(
            municipality=self.muni_a,
            vehicle=self.vehicle_a,
            driver=self.driver_a,
            origin="A",
            destination="B",
            departure_datetime=base_date,
            return_datetime_expected=base_date + timezone.timedelta(hours=1),
            odometer_start=1000,
            passengers_count=3,
            status=Trip.Status.PLANNED,
        )
        Trip.objects.create(
            municipality=self.muni_a,
            vehicle=self.vehicle_a,
            driver=self.driver_a,
            origin="C",
            destination="D",
            departure_datetime=base_date + timezone.timedelta(days=1),
            return_datetime_expected=base_date + timezone.timedelta(days=1, hours=1),
            odometer_start=1010,
            passengers_count=2,
            status=Trip.Status.COMPLETED,
        )
        Trip.objects.create(
            municipality=self.muni_b,
            vehicle=self.vehicle_b,
            driver=self.driver_b,
            origin="X",
            destination="Y",
            departure_datetime=base_date,
            return_datetime_expected=base_date + timezone.timedelta(hours=2),
            odometer_start=2000,
            passengers_count=5,
            status=Trip.Status.PLANNED,
        )

    def test_trip_report_filters_by_municipality_and_date(self):
        self.client.force_authenticate(self.admin_a)
        resp = self.client.get("/api/reports/trips/?start_date=2024-01-10&end_date=2024-01-10")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["summary"]["total"], 1)
        self.assertEqual(resp.data["summary"]["total_passengers"], 3)
        self.assertEqual(len(resp.data["trips"]), 1)
        self.assertEqual(resp.data["trips"][0]["origin"], "A")

    def test_trip_report_superadmin_sees_all(self):
        self.client.force_authenticate(self.superadmin)
        resp = self.client.get("/api/reports/trips/?start_date=2024-01-10&end_date=2024-01-10")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["summary"]["total"], 2)
        self.assertEqual(resp.data["summary"]["total_passengers"], 8)
