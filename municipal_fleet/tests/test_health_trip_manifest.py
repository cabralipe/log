from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drivers.models import Driver
from fleet.models import Vehicle
from health.models import Patient, Companion
from tenants.models import Municipality


class HealthTripManifestTests(TestCase):
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
        self.driver = Driver.objects.create(
            municipality=self.municipality,
            name="Motorista",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )

    def _make_vehicle(self, max_passengers):
        return Vehicle.objects.create(
            municipality=self.municipality,
            license_plate=f"ABC{max_passengers:04d}",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=max_passengers,
            odometer_current=1000,
            odometer_initial=900,
            odometer_monthly_limit=2000,
        )

    def _make_patient(self, needs_companion=True):
        return Patient.objects.create(
            municipality=self.municipality,
            full_name="Paciente 1",
            cpf="123.456.789-00",
            date_of_birth="1990-01-01",
            comorbidities="",
            needs_companion=needs_companion,
            notes="",
        )

    def _create_execution_with_manifest(self, vehicle, patient):
        departure = timezone.now()
        payload = {
            "module": "HEALTH",
            "vehicle": vehicle.id,
            "driver": self.driver.id,
            "scheduled_departure": departure.isoformat(),
            "scheduled_return": (departure + timedelta(hours=1)).isoformat(),
            "planned_capacity": vehicle.max_passengers,
            "manifest": {
                "passengers": [
                    {
                        "passenger_type": "PATIENT",
                        "patient": patient.id,
                    }
                ]
            },
        }
        return self.client.post("/api/trips/executions/", payload, format="json")

    def _get_manifest(self, execution_id):
        resp = self.client.get("/api/trips/manifests/", {"trip_execution": execution_id})
        self.assertEqual(resp.status_code, 200)
        data = resp.data.get("results", resp.data)
        self.assertTrue(data)
        return data[0]

    def test_health_manifest_auto_adds_companion(self):
        vehicle = self._make_vehicle(max_passengers=2)
        patient = self._make_patient(needs_companion=True)
        companion = Companion.objects.create(
            municipality=self.municipality,
            patient=patient,
            full_name="Acompanhante 1",
            cpf="987.654.321-00",
            date_of_birth="1980-01-01",
            relationship="Pai",
            phone="11999990000",
            notes="",
            active=True,
        )

        resp = self._create_execution_with_manifest(vehicle, patient)
        self.assertEqual(resp.status_code, 201)
        execution_id = resp.data["id"]

        manifest = self._get_manifest(execution_id)
        passengers = manifest.get("passengers", [])
        self.assertEqual(len(passengers), 2)
        companion_entries = [p for p in passengers if p["passenger_type"] == "COMPANION"]
        self.assertEqual(len(companion_entries), 1)
        self.assertEqual(companion_entries[0]["companion"], companion.id)
        self.assertEqual(companion_entries[0]["linked_patient"], patient.id)

    def test_health_manifest_requires_companion_when_needed(self):
        vehicle = self._make_vehicle(max_passengers=2)
        patient = self._make_patient(needs_companion=True)

        resp = self._create_execution_with_manifest(vehicle, patient)
        self.assertEqual(resp.status_code, 400)

    def test_health_manifest_capacity_after_companion(self):
        vehicle = self._make_vehicle(max_passengers=1)
        patient = self._make_patient(needs_companion=True)
        Companion.objects.create(
            municipality=self.municipality,
            patient=patient,
            full_name="Acompanhante 1",
            cpf="987.654.321-00",
            date_of_birth="1980-01-01",
            relationship="Pai",
            phone="11999990000",
            notes="",
            active=True,
        )

        resp = self._create_execution_with_manifest(vehicle, patient)
        self.assertEqual(resp.status_code, 400)
