from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from contracts.models import Contract, RentalPeriod
from drivers.models import Driver
from fleet.models import FuelLog, FuelStation, Vehicle
from maintenance.models import ServiceOrder
from tenants.models import Municipality
from trips.models import MonthlyOdometer


class FuelCostsAndTcoTests(TestCase):
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
        self.admin = User.objects.create_user(
            email="admin@city.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.municipality,
        )
        self.client.force_authenticate(self.admin)
        self.vehicle = Vehicle.objects.create(
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
        self.driver = Driver.objects.create(
            municipality=self.municipality,
            name="Motorista",
            cpf="111.111.111-11",
            cnh_number="12345",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )
        self.station = FuelStation.objects.create(
            municipality=self.municipality,
            name="Posto Central",
            cnpj="12.345.678/0001-90",
            address="Rua B",
            active=True,
        )

    def test_fuel_log_requires_price_per_liter(self):
        payload = {
            "vehicle": self.vehicle.id,
            "driver": self.driver.id,
            "fuel_station_id": self.station.id,
            "filled_at": "2024-01-10",
            "liters": "50.00",
        }
        resp = self.client.post("/api/vehicles/fuel_logs/", payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("price_per_liter", resp.data)

    def test_fuel_log_calculates_total_cost(self):
        payload = {
            "vehicle": self.vehicle.id,
            "driver": self.driver.id,
            "fuel_station_id": self.station.id,
            "filled_at": "2024-01-10",
            "liters": "50.00",
            "price_per_liter": "6.10",
        }
        resp = self.client.post("/api/vehicles/fuel_logs/", payload, format="json")
        self.assertEqual(resp.status_code, 201)
        log = FuelLog.objects.get(id=resp.data["id"])
        self.assertEqual(log.total_cost, Decimal("305.00"))

    def test_fuel_costs_report_monthly_and_annual(self):
        FuelLog.objects.create(
            municipality=self.municipality,
            vehicle=self.vehicle,
            driver=self.driver,
            filled_at="2024-01-05",
            liters=Decimal("40.00"),
            price_per_liter=Decimal("5.00"),
            fuel_station=self.station.name,
            fuel_station_ref=self.station,
        )
        FuelLog.objects.create(
            municipality=self.municipality,
            vehicle=self.vehicle,
            driver=self.driver,
            filled_at="2024-02-10",
            liters=Decimal("20.00"),
            price_per_liter=Decimal("6.00"),
            fuel_station=self.station.name,
            fuel_station_ref=self.station,
        )
        resp = self.client.get("/api/reports/fuel-costs/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Decimal(str(resp.data["summary"]["total_cost"])), Decimal("320.00"))
        self.assertEqual(len(resp.data["fleet_monthly"]), 2)
        jan = resp.data["fleet_monthly"][0]
        self.assertEqual(jan["period"], "2024-01-01")
        self.assertEqual(Decimal(str(jan["total_cost"])), Decimal("200.00"))

    def test_tco_report_cost_per_km(self):
        FuelLog.objects.create(
            municipality=self.municipality,
            vehicle=self.vehicle,
            driver=self.driver,
            filled_at=timezone.localdate(),
            liters=Decimal("20.00"),
            price_per_liter=Decimal("10.00"),
            fuel_station=self.station.name,
            fuel_station_ref=self.station,
        )
        ServiceOrder.objects.create(
            municipality=self.municipality,
            vehicle=self.vehicle,
            opened_by=self.admin,
            provider_name="Oficina",
            type=ServiceOrder.Type.CORRECTIVE,
            priority=ServiceOrder.Priority.MEDIUM,
            status=ServiceOrder.Status.COMPLETED,
            description="Troca de óleo",
            completed_at=timezone.now(),
            total_cost=Decimal("100.00"),
        )
        contract = Contract.objects.create(
            municipality=self.municipality,
            contract_number="CONTR-01",
            description="Contrato teste",
            type=Contract.Type.RENTAL,
            provider_name="Fornecedor",
            provider_cnpj="12.345.678/0001-90",
            start_date="2024-01-01",
            end_date="2025-01-01",
            billing_model=Contract.BillingModel.FIXED,
            base_value=Decimal("0.00"),
        )
        RentalPeriod.objects.create(
            municipality=self.municipality,
            contract=contract,
            vehicle=self.vehicle,
            start_datetime=timezone.now(),
            end_datetime=timezone.now(),
            billed_km=Decimal("1000.00"),
            billed_amount=Decimal("300.00"),
            status=RentalPeriod.Status.CLOSED,
        )
        MonthlyOdometer.objects.create(vehicle=self.vehicle, year=2024, month=1, kilometers=1000)

        resp = self.client.get("/api/reports/tco/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["summary"]["total_km"], 1000.0)
        self.assertAlmostEqual(resp.data["summary"]["cost_per_km"], 0.6, places=2)
        self.assertEqual(resp.data["vehicles"][0]["vehicle__license_plate"], "ABC1234")

    def test_fuel_budget_settings_and_alert(self):
        FuelLog.objects.create(
            municipality=self.municipality,
            vehicle=self.vehicle,
            driver=self.driver,
            filled_at=timezone.localdate(),
            liters=Decimal("10.00"),
            price_per_liter=Decimal("15.00"),
            fuel_station=self.station.name,
            fuel_station_ref=self.station,
        )
        patch_resp = self.client.patch(
            "/api/municipalities/settings/",
            {"fuel_contract_limit": 100, "fuel_contract_period": "MONTHLY"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        report = self.client.get("/api/reports/fuel/")
        self.assertEqual(report.status_code, 200)
        budget = report.data["summary"]["budget"]
        self.assertTrue(budget["over_limit"])
        self.assertEqual(budget["period"], "MONTHLY")
