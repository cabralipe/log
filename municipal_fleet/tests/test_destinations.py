from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from destinations.models import Destination
from tenants.models import Municipality


class DestinationViewSetTests(TestCase):
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
        self.viewer_a = User.objects.create_user(
            email="viewer@a.com",
            password="pass123",
            role=User.Roles.VIEWER,
            municipality=self.muni_a,
        )
        self.superadmin = User.objects.create_user(
            email="root@example.com",
            password="pass123",
            role=User.Roles.SUPERADMIN,
        )

    def _payload(self):
        return {
            "name": "Escola Central",
            "type": "SCHOOL",
            "address": "Rua Principal",
            "number": "100",
            "district": "Centro",
            "city": "Cidade",
            "state": "SP",
            "postal_code": "01000-000",
            "latitude": "-23.550520",
            "longitude": "-46.633308",
            "active": True,
        }

    def test_viewer_cannot_create_destination(self):
        self.client.force_authenticate(self.viewer_a)
        resp = self.client.post("/api/destinations/", self._payload(), format="json")
        self.assertEqual(resp.status_code, 403)

    def test_admin_create_ignores_payload_municipality(self):
        self.client.force_authenticate(self.admin_a)
        payload = self._payload()
        payload["municipality"] = self.muni_b.id
        resp = self.client.post("/api/destinations/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["municipality"], self.muni_a.id)

    def test_superadmin_can_create_for_other_municipality(self):
        self.client.force_authenticate(self.superadmin)
        payload = self._payload()
        payload["municipality"] = self.muni_b.id
        payload["name"] = "Evento Municipal"
        payload["type"] = "EVENT"
        resp = self.client.post("/api/destinations/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["municipality"], self.muni_b.id)

    def test_list_filters_by_municipality_type_and_search(self):
        Destination.objects.create(
            municipality=self.muni_a,
            name="Hospital Central",
            type=Destination.DestinationType.HEALTH_UNIT,
            address="Rua A",
            number="10",
            district="Centro",
            city="Cidade",
            state="SP",
            postal_code="01000-000",
            latitude="-23.55",
            longitude="-46.63",
        )
        Destination.objects.create(
            municipality=self.muni_a,
            name="Parque do Evento",
            type=Destination.DestinationType.EVENT,
            address="Rua B",
            number="20",
            district="Bairro",
            city="Cidade",
            state="SP",
            postal_code="02000-000",
            latitude="-23.56",
            longitude="-46.64",
        )
        Destination.objects.create(
            municipality=self.muni_b,
            name="Escola Outra",
            type=Destination.DestinationType.SCHOOL,
            address="Rua C",
            number="30",
            district="Centro",
            city="Cidade",
            state="SP",
            postal_code="03000-000",
            latitude="-23.57",
            longitude="-46.65",
        )

        self.client.force_authenticate(self.viewer_a)
        resp = self.client.get("/api/destinations/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 2)

        resp = self.client.get("/api/destinations/?type=EVENT")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["name"], "Parque do Evento")

        resp = self.client.get("/api/destinations/?search=Hospital")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["name"], "Hospital Central")
