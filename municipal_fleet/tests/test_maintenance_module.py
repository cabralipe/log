from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from tenants.models import Municipality
from fleet.models import Vehicle
from drivers.models import Driver
from maintenance.models import MaintenancePlan, ServiceOrder, InventoryPart, InventoryMovement, Tire, VehicleTire


class MaintenanceIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.municipality = Municipality.objects.create(
            name="Cidade Teste",
            cnpj="11.111.111/0001-11",
            address="Rua B",
            city="Cidade",
            state="SP",
            phone="11999999999",
        )
        self.user = User.objects.create_user(
            email="admin@example.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.municipality,
        )
        self.client.force_authenticate(self.user)
        self.driver = Driver.objects.create(
            municipality=self.municipality,
            name="Motorista",
            cpf="123.456.789-00",
            cnh_number="9999",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11988887777",
        )

    def _create_vehicle(self, odometer=1000):
        return Vehicle.objects.create(
            municipality=self.municipality,
            license_plate=f"AAA{odometer % 9999}",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=odometer,
            odometer_initial=odometer,
        )

    def _trip_payload(self, vehicle, odometer_start, odometer_end):
        start = timezone.now()
        end = start + timedelta(hours=2)
        return {
            "vehicle": vehicle.id,
            "driver": self.driver.id,
            "origin": "A",
            "destination": "B",
            "departure_datetime": start,
            "return_datetime_expected": end,
            "odometer_start": odometer_start,
            "odometer_end": odometer_end,
            "status": "COMPLETED",
            "passengers_count": 1,
        }

    def test_preventive_service_order_created_after_trip(self):
        vehicle = self._create_vehicle(odometer=1000)
        MaintenancePlan.objects.create(
            municipality=self.municipality,
            vehicle=vehicle,
            name="Revisão 100 km",
            trigger_type=MaintenancePlan.TriggerType.KM,
            interval_km=50,
            last_service_odometer=900,
        )
        payload = self._trip_payload(vehicle, odometer_start=1000, odometer_end=1060)
        resp = self.client.post("/api/trips/", payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(
            ServiceOrder.objects.filter(vehicle=vehicle, type=ServiceOrder.Type.PREVENTIVE).exists(),
            "Deveria gerar OS preventiva automática",
        )

    def test_vehicle_in_maintenance_blocks_new_trip(self):
        vehicle = self._create_vehicle()
        create_os = self.client.post(
            "/api/service-orders/",
            {
                "municipality": self.municipality.id,
                "vehicle": vehicle.id,
                "type": ServiceOrder.Type.CORRECTIVE,
                "priority": ServiceOrder.Priority.HIGH,
                "status": ServiceOrder.Status.OPEN,
                "description": "Falha mecânica",
            },
            format="json",
        )
        self.assertEqual(create_os.status_code, 201, create_os.data)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.status, Vehicle.Status.MAINTENANCE)
        payload = self._trip_payload(vehicle, odometer_start=vehicle.odometer_current, odometer_end=vehicle.odometer_current + 10)
        trip_resp = self.client.post("/api/trips/", payload, format="json")
        self.assertEqual(trip_resp.status_code, 400)

    def test_inventory_decreases_when_using_part(self):
        vehicle = self._create_vehicle()
        part = InventoryPart.objects.create(
            municipality=self.municipality,
            name="Filtro de óleo",
            sku="FILTRO-001",
            unit="UN",
            minimum_stock=Decimal("1"),
            current_stock=Decimal("10"),
        )
        resp = self.client.post(
            "/api/service-orders/",
            {
                "municipality": self.municipality.id,
                "vehicle": vehicle.id,
                "type": ServiceOrder.Type.CORRECTIVE,
                "priority": ServiceOrder.Priority.MEDIUM,
                "status": ServiceOrder.Status.OPEN,
                "description": "Troca de filtro",
                "items": [
                    {
                        "part": part.id,
                        "quantity": "2",
                        "unit_cost": "50.00",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        part.refresh_from_db()
        self.assertEqual(part.current_stock, Decimal("8"))
        self.assertTrue(
            InventoryMovement.objects.filter(part=part, type=InventoryMovement.MovementType.OUT).exists(),
            "Deveria registrar saída no estoque",
        )

    def test_tires_update_after_trip(self):
        vehicle = self._create_vehicle(odometer=0)
        tire = Tire.objects.create(
            municipality=self.municipality,
            code="PNEU-001",
            brand="Pirelli",
            model="Aro15",
            size="15",
            max_km_life=100,
        )
        VehicleTire.objects.create(tire=tire, vehicle=vehicle, position=VehicleTire.Position.FRONT_LEFT, installed_odometer=0)
        payload = self._trip_payload(vehicle, odometer_start=0, odometer_end=120)
        resp = self.client.post("/api/trips/", payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        tire.refresh_from_db()
        self.assertEqual(tire.total_km, 120)
        self.assertTrue(
            ServiceOrder.objects.filter(vehicle=vehicle, type=ServiceOrder.Type.TIRE).exists(),
            "Deveria abrir OS para pneus ao atingir vida útil",
        )
