from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from destinations.models import Destination
from drivers.models import Driver
from fleet.models import Vehicle
from tenants.models import Municipality
from trips.models import TripExecution, TripExecutionStop


class TripExecutionActionsTests(TestCase):
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
        self.dest_a = Destination.objects.create(
            municipality=self.muni,
            name="Destino A",
            type=Destination.DestinationType.SCHOOL,
            address="Rua A",
            number="10",
            district="Centro",
            city="Cidade",
            state="SP",
            postal_code="01000-000",
            latitude="0.000000",
            longitude="0.000000",
        )
        self.dest_b = Destination.objects.create(
            municipality=self.muni,
            name="Destino B",
            type=Destination.DestinationType.SCHOOL,
            address="Rua B",
            number="20",
            district="Centro",
            city="Cidade",
            state="SP",
            postal_code="01000-000",
            latitude="0.000000",
            longitude="2.000000",
        )
        self.dest_c = Destination.objects.create(
            municipality=self.muni,
            name="Destino C",
            type=Destination.DestinationType.SCHOOL,
            address="Rua C",
            number="30",
            district="Centro",
            city="Cidade",
            state="SP",
            postal_code="01000-000",
            latitude="0.000000",
            longitude="1.000000",
        )
        now = timezone.now()
        self.execution = TripExecution.objects.create(
            municipality=self.muni,
            vehicle=self.vehicle,
            driver=self.driver,
            scheduled_departure=now,
            scheduled_return=now + timezone.timedelta(hours=1),
        )
        TripExecutionStop.objects.create(
            trip_execution=self.execution,
            destination=self.dest_a,
            order=1,
        )
        TripExecutionStop.objects.create(
            trip_execution=self.execution,
            destination=self.dest_b,
            order=2,
        )
        TripExecutionStop.objects.create(
            trip_execution=self.execution,
            destination=self.dest_c,
            order=3,
        )

    def test_itinerary_returns_stops(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get(f"/api/trips/executions/{self.execution.id}/itinerary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["stops"]), 3)
        self.assertEqual(resp.data["stops"][0]["destination_id"], self.dest_a.id)

    def test_optimize_route_reorders_stops(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(f"/api/trips/executions/{self.execution.id}/optimize-route/")
        self.assertEqual(resp.status_code, 200)
        orders = list(self.execution.stops.order_by("order").values_list("destination_id", flat=True))
        self.assertEqual(orders, [self.dest_a.id, self.dest_c.id, self.dest_b.id])

    def test_optimize_route_without_stops(self):
        self.execution.stops.all().delete()
        self.client.force_authenticate(self.admin)
        resp = self.client.post(f"/api/trips/executions/{self.execution.id}/optimize-route/")
        self.assertEqual(resp.status_code, 400)
