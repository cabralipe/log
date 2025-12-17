from datetime import timedelta, datetime, time
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tenants.models import Municipality
from accounts.models import User
from fleet.models import Vehicle
from drivers.models import Driver
from trips.models import Trip
from scheduling.models import DriverAvailabilityBlock


class SchedulingIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni = Municipality.objects.create(
            name="Pref X",
            cnpj="55.555.555/0001-55",
            address="Rua X",
            city="Cidade",
            state="SP",
            phone="1100000000",
        )
        self.other_muni = Municipality.objects.create(
            name="Pref Y",
            cnpj="66.666.666/0001-66",
            address="Rua Y",
            city="Cidade",
            state="SP",
            phone="1199999999",
        )
        self.admin = User.objects.create_user(
            email="admin@x.com", password="pass123", role=User.Roles.ADMIN_MUNICIPALITY, municipality=self.muni
        )
        self.other_admin = User.objects.create_user(
            email="admin@y.com", password="pass123", role=User.Roles.ADMIN_MUNICIPALITY, municipality=self.other_muni
        )
        self.client.force_authenticate(self.admin)
        self.vehicle = Vehicle.objects.create(
            municipality=self.muni,
            license_plate="AAA1A11",
            model="Van",
            brand="VW",
            year=2022,
            max_passengers=10,
            odometer_current=100,
            odometer_initial=0,
            odometer_monthly_limit=1000,
        )
        self.driver = Driver.objects.create(
            municipality=self.muni,
            name="Motorista X",
            cpf="555.555.555-55",
            cnh_number="99999",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11988888888",
        )

    def test_block_prevents_trip_creation(self):
        start = timezone.now() + timedelta(hours=1)
        end = start + timedelta(hours=2)
        DriverAvailabilityBlock.objects.create(
            municipality=self.muni,
            driver=self.driver,
            type=DriverAvailabilityBlock.BlockType.VACATION,
            start_datetime=start,
            end_datetime=end,
            status=DriverAvailabilityBlock.Status.ACTIVE,
        )
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": self.vehicle.id,
                "driver": self.driver.id,
                "origin": "A",
                "destination": "B",
                "departure_datetime": start + timedelta(minutes=10),
                "return_datetime_expected": end,
                "odometer_start": 100,
                "passengers_count": 2,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Motorista indisponível", str(resp.data))

    def test_driver_conflict_with_other_trip(self):
        now = timezone.now()
        Trip.objects.create(
            municipality=self.muni,
            vehicle=self.vehicle,
            driver=self.driver,
            origin="A",
            destination="B",
            departure_datetime=now,
            return_datetime_expected=now + timedelta(hours=2),
            odometer_start=100,
            passengers_count=1,
        )
        other_vehicle = Vehicle.objects.create(
            municipality=self.muni,
            license_plate="BBB2B22",
            model="Van",
            brand="VW",
            year=2022,
            max_passengers=10,
            odometer_current=200,
            odometer_initial=0,
            odometer_monthly_limit=1000,
        )
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": other_vehicle.id,
                "driver": self.driver.id,
                "origin": "C",
                "destination": "D",
                "departure_datetime": now + timedelta(minutes=30),
                "return_datetime_expected": now + timedelta(hours=3),
                "odometer_start": 120,
                "passengers_count": 1,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("motorista já está em outra viagem", str(resp.data))

    def test_driver_from_other_municipality_not_allowed(self):
        other_driver = Driver.objects.create(
            municipality=self.other_muni,
            name="Outro",
            cpf="666.666.666-66",
            cnh_number="11111",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="1177777777",
        )
        now = timezone.now()
        resp = self.client.post(
            "/api/trips/",
            {
                "vehicle": self.vehicle.id,
                "driver": other_driver.id,
                "origin": "A",
                "destination": "B",
                "departure_datetime": now + timedelta(hours=1),
                "return_datetime_expected": now + timedelta(hours=2),
                "odometer_start": 100,
                "passengers_count": 1,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_available_drivers_endpoint_filters_conflicts(self):
        available_driver = Driver.objects.create(
            municipality=self.muni,
            name="Livre",
            cpf="777.777.777-77",
            cnh_number="22222",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="1190000000",
        )
        start = timezone.now() + timedelta(hours=1)
        end = start + timedelta(hours=2)
        Trip.objects.create(
            municipality=self.muni,
            vehicle=self.vehicle,
            driver=self.driver,
            origin="A",
            destination="B",
            departure_datetime=start,
            return_datetime_expected=end,
            odometer_start=100,
            passengers_count=1,
        )
        block_start = start + timedelta(hours=3)
        DriverAvailabilityBlock.objects.create(
            municipality=self.muni,
            driver=available_driver,
            type=DriverAvailabilityBlock.BlockType.DAY_OFF,
            start_datetime=block_start,
            end_datetime=block_start + timedelta(hours=2),
        )
        resp = self.client.get(
            "/api/drivers/available/",
            {"start": start.isoformat(), "end": end.isoformat()},
        )
        self.assertEqual(resp.status_code, 200)
        ids = [item["id"] for item in resp.data["available_drivers"]]
        self.assertIn(available_driver.id, ids)
        self.assertNotIn(self.driver.id, ids)

    def test_calendar_endpoint_returns_events(self):
        start = timezone.localtime() + timedelta(days=1)
        end = start + timedelta(hours=2)
        trip = Trip.objects.create(
            municipality=self.muni,
            vehicle=self.vehicle,
            driver=self.driver,
            origin="A",
            destination="B",
            departure_datetime=start,
            return_datetime_expected=end,
            odometer_start=100,
            passengers_count=1,
        )
        DriverAvailabilityBlock.objects.create(
            municipality=self.muni,
            driver=self.driver,
            type=DriverAvailabilityBlock.BlockType.TRAINING,
            start_datetime=end + timedelta(hours=1),
            end_datetime=end + timedelta(hours=2),
        )
        self.assertEqual(Trip.objects.count(), 1)
        trip_obj = Trip.objects.first()
        self.assertIsNotNone(trip_obj)
        start_dt = timezone.make_aware(datetime.combine(start.date(), time.min), timezone.get_default_timezone())
        end_dt = timezone.make_aware(
            datetime.combine((end + timedelta(days=1)).date(), time.max), timezone.get_default_timezone()
        )
        self.assertTrue(trip_obj.departure_datetime < end_dt, (trip_obj.departure_datetime, end_dt))
        self.assertTrue(trip_obj.return_datetime_expected > start_dt, (trip_obj.return_datetime_expected, start_dt))
        self.assertEqual(
            Trip.objects.filter(
                driver=self.driver,
                status__in=[Trip.Status.PLANNED, Trip.Status.IN_PROGRESS],
                departure_datetime__lt=end_dt,
                return_datetime_expected__gt=start_dt,
            ).count(),
            1,
        )
        resp = self.client.get(
            f"/api/drivers/{self.driver.id}/calendar/",
            {"start_date": start.date().isoformat(), "end_date": (end + timedelta(days=1)).date().isoformat()},
        )
        self.assertEqual(resp.status_code, 200)
        types = {event["type"] for event in resp.data["events"]}
        self.assertEqual(types, {"TRIP", "BLOCK"}, resp.data)
        trip_event = next(e for e in resp.data["events"] if e["type"] == "TRIP")
        self.assertEqual(trip_event["id"], trip.id)

    def test_permissions_block_other_municipality(self):
        block = DriverAvailabilityBlock.objects.create(
            municipality=self.other_muni,
            driver=Driver.objects.create(
                municipality=self.other_muni,
                name="Outro Driver",
                cpf="888.888.888-88",
                cnh_number="33333",
                cnh_category="D",
                cnh_expiration_date="2030-01-01",
                phone="11888888888",
            ),
            type=DriverAvailabilityBlock.BlockType.ADMIN_BLOCK,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
        )
        self.client.force_authenticate(self.admin)
        resp = self.client.get(f"/api/driver-availability-blocks/{block.id}/")
        self.assertEqual(resp.status_code, 404)

    def test_free_trip_respects_driver_block(self):
        now = timezone.now()
        DriverAvailabilityBlock.objects.create(
            municipality=self.muni,
            driver=self.driver,
            type=DriverAvailabilityBlock.BlockType.DAY_OFF,
            start_datetime=now - timedelta(minutes=30),
            end_datetime=now + timedelta(hours=2),
        )
        resp = self.client.post(
            "/api/free-trips/",
            {
                "driver": self.driver.id,
                "vehicle": self.vehicle.id,
                "odometer_start": 100,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Motorista indisponível", str(resp.data))
