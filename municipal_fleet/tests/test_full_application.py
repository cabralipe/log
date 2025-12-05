from datetime import timedelta, datetime, timezone as dt_timezone

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from django.core.management import call_command

from accounts.models import User
from tenants.models import Municipality
from fleet.models import Vehicle
from drivers.models import Driver
from trips.models import Trip, MonthlyOdometer


class FullApplicationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Pref A",
            cnpj="10.000.000/0001-10",
            address="Rua 1",
            city="Cidade",
            state="SP",
            phone="11999990000",
        )
        self.muni_b = Municipality.objects.create(
            name="Pref B",
            cnpj="20.000.000/0001-20",
            address="Rua 2",
            city="Cidade",
            state="SP",
            phone="11888880000",
        )
        self.superadmin = User.objects.create_user(
            email="super@example.com", password="pass123", role=User.Roles.SUPERADMIN
        )
        self.admin_a = User.objects.create_user(
            email="admin.a@example.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin.b@example.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_b,
        )

    def _make_vehicle(self, municipality, license_plate="AAA1234", **extra):
        defaults = {
            "model": "Van",
            "brand": "Ford",
            "year": 2020,
            "max_passengers": 10,
            "odometer_current": 100,
            "odometer_initial": 100,
            "odometer_monthly_limit": 150,
        }
        defaults.update(extra)
        return Vehicle.objects.create(municipality=municipality, license_plate=license_plate, **defaults)

    def _make_driver(self, municipality, name="Driver", cpf="111.111.111-11"):
        return Driver.objects.create(
            municipality=municipality,
            name=name,
            cpf=cpf,
            cnh_number="12345",
            cnh_category="B",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )

    def test_auth_flow_login_refresh_and_logout(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"email": self.admin_a.email, "password": "pass123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        access = resp.data["access"]
        refresh = resp.data["refresh"]

        resp_refresh = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(resp_refresh.status_code, 200)
        access_refresh = resp_refresh.data["access"]

        auth_client = APIClient()
        auth_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_refresh}")
        logout_resp = auth_client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
        self.assertEqual(logout_resp.status_code, 200)

        blocked_refresh = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(blocked_refresh.status_code, 401)

    def test_vehicle_list_is_filtered_by_municipality(self):
        self._make_vehicle(self.muni_a, license_plate="AAA0001")
        self._make_vehicle(self.muni_b, license_plate="BBB0002")

        self.client.force_authenticate(self.admin_a)
        resp = self.client.get("/api/vehicles/")
        self.assertEqual(resp.status_code, 200)
        plates = [v["license_plate"] for v in resp.data["results"]] if isinstance(resp.data, dict) else [
            v["license_plate"] for v in resp.data
        ]
        self.assertListEqual(plates, ["AAA0001"])

        self.client.force_authenticate(self.superadmin)
        resp_super = self.client.get("/api/vehicles/")
        self.assertEqual(resp_super.status_code, 200)
        plates_super = (
            [v["license_plate"] for v in resp_super.data["results"]]
            if isinstance(resp_super.data, dict)
            else [v["license_plate"] for v in resp_super.data]
        )
        self.assertIn("AAA0001", plates_super)
        self.assertIn("BBB0002", plates_super)

    def test_trip_completion_updates_odometer_and_vehicle_status(self):
        vehicle = self._make_vehicle(self.muni_a, license_plate="AAA0101", odometer_current=120, odometer_initial=120)
        driver = self._make_driver(self.muni_a)
        self.client.force_authenticate(self.admin_a)
        departure = timezone.now()
        trip_resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": vehicle.id,
                "driver": driver.id,
                "origin": "Origem",
                "destination": "Destino",
                "departure_datetime": departure,
                "return_datetime_expected": departure + timedelta(hours=2),
                "odometer_start": 120,
                "passengers_count": 4,
            },
            format="json",
        )
        self.assertEqual(trip_resp.status_code, 201, trip_resp.data)
        trip_id = trip_resp.data["id"]

        complete_resp = self.client.patch(
            f"/api/trips/{trip_id}/",
            {
                "status": Trip.Status.COMPLETED,
                "odometer_end": 300,
                "return_datetime_actual": departure + timedelta(hours=2),
            },
            format="json",
        )
        self.assertEqual(complete_resp.status_code, 200, complete_resp.data)

        vehicle.refresh_from_db()
        self.assertEqual(vehicle.odometer_current, 300)
        self.assertEqual(vehicle.status, Vehicle.Status.MAINTENANCE)
        summary = MonthlyOdometer.objects.get(vehicle=vehicle, year=departure.year, month=departure.month)
        self.assertEqual(summary.kilometers, 180)

    def test_vehicle_in_maintenance_rejects_trip(self):
        vehicle = self._make_vehicle(
            self.muni_a,
            license_plate="AAA0303",
            odometer_current=200,
            odometer_initial=200,
            status=Vehicle.Status.MAINTENANCE,
        )
        driver = self._make_driver(self.muni_a, cpf="333.333.333-33", name="Driver M")
        self.client.force_authenticate(self.admin_a)
        departure = timezone.now()
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": vehicle.id,
                "driver": driver.id,
                "origin": "Origem",
                "destination": "Destino",
                "departure_datetime": departure,
                "return_datetime_expected": departure + timedelta(hours=1),
                "odometer_start": 200,
                "passengers_count": 2,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_rebuild_monthly_odometer_command(self):
        vehicle = self._make_vehicle(self.muni_a, license_plate="AAA0404", odometer_current=100, odometer_initial=100)
        driver = self._make_driver(self.muni_a, cpf="444.444.444-44", name="Driver O")
        self.client.force_authenticate(self.admin_a)

        jan_departure = datetime(2024, 1, 15, 12, 0, tzinfo=dt_timezone.utc)
        feb_departure = datetime(2024, 2, 10, 12, 0, tzinfo=dt_timezone.utc)

        Trip.objects.create(
            municipality=self.muni_a,
            vehicle=vehicle,
            driver=driver,
            origin="A",
            destination="B",
            departure_datetime=jan_departure,
            return_datetime_expected=jan_departure + timedelta(hours=1),
            odometer_start=100,
            odometer_end=130,
            passengers_count=2,
            status=Trip.Status.COMPLETED,
        )
        Trip.objects.create(
            municipality=self.muni_a,
            vehicle=vehicle,
            driver=driver,
            origin="C",
            destination="D",
            departure_datetime=feb_departure,
            return_datetime_expected=feb_departure + timedelta(hours=1),
            odometer_start=130,
            odometer_end=170,
            passengers_count=2,
            status=Trip.Status.COMPLETED,
        )

        call_command("rebuild_monthly_odometer")

        jan_summary = MonthlyOdometer.objects.get(vehicle=vehicle, year=2024, month=1)
        feb_summary = MonthlyOdometer.objects.get(vehicle=vehicle, year=2024, month=2)
        self.assertEqual(jan_summary.kilometers, 30)
        self.assertEqual(feb_summary.kilometers, 40)

    def test_reports_endpoints_return_scoped_data(self):
        vehicle = self._make_vehicle(self.muni_a, license_plate="AAA0202", odometer_current=500, odometer_initial=500)
        driver = self._make_driver(self.muni_a, cpf="222.222.222-22", name="Driver A")
        self.client.force_authenticate(self.admin_a)
        departure = timezone.now()
        trip = Trip.objects.create(
            municipality=self.muni_a,
            vehicle=vehicle,
            driver=driver,
            origin="A",
            destination="B",
            departure_datetime=departure,
            return_datetime_expected=departure + timedelta(hours=1),
            odometer_start=500,
            odometer_end=530,
            passengers_count=3,
            status=Trip.Status.COMPLETED,
        )
        MonthlyOdometer.objects.create(vehicle=vehicle, year=departure.year, month=departure.month, kilometers=30)

        dashboard = self.client.get("/api/reports/dashboard/")
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data["total_vehicles"], 1)
        self.assertEqual(dashboard.data["trips_month_total"], 1)
        self.assertTrue(any(item["status"] == Trip.Status.COMPLETED for item in dashboard.data["trips_by_status"]))

        odometer = self.client.get("/api/reports/odometer/")
        self.assertEqual(odometer.status_code, 200)
        self.assertEqual(odometer.data[0]["kilometers"], 30)

        trips_report = self.client.get("/api/reports/trips/")
        self.assertEqual(trips_report.status_code, 200)
        self.assertEqual(trips_report.data["summary"]["total"], 1)
        self.assertEqual(trips_report.data["summary"]["total_passengers"], 3)
        self.assertEqual(trips_report.data["trips"][0]["driver__name"], "Driver A")
