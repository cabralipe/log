from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from contracts.models import Contract, ContractVehicle
from fleet.models import FuelStation, Vehicle
from tenants.models import Municipality


class FleetContractsCrudTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.muni_a = Municipality.objects.create(
            name="Cidade A",
            cnpj="11.111.111/0001-11",
            address="Rua A",
            city="Cidade A",
            state="SP",
            phone="11999999999",
        )
        self.muni_b = Municipality.objects.create(
            name="Cidade B",
            cnpj="22.222.222/0001-22",
            address="Rua B",
            city="Cidade B",
            state="SP",
            phone="11888888888",
        )
        self.admin_a = User.objects.create_user(
            email="admin-a@test.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin-b@test.com",
            password="pass123",
            role=User.Roles.ADMIN_MUNICIPALITY,
            municipality=self.muni_b,
        )
        self.superadmin = User.objects.create_user(
            email="super@test.com",
            password="pass123",
            role=User.Roles.SUPERADMIN,
        )

    def _results(self, resp):
        data = resp.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_vehicle_crud_search_and_scoping(self):
        Vehicle.objects.create(
            municipality=self.muni_b,
            license_plate="BBB0001",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=100,
            odometer_initial=100,
            odometer_monthly_limit=500,
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/vehicles/",
            {
                "municipality": self.muni_a.id,
                "license_plate": "AAA0001",
                "model": "Onibus",
                "brand": "Mercedes",
                "year": 2019,
                "max_passengers": 20,
                "odometer_current": 1000,
                "odometer_initial": 900,
                "odometer_monthly_limit": 2000,
                "ownership_type": "OWNED",
                "status": "AVAILABLE",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201, create_resp.data)
        vehicle_id = create_resp.data["id"]

        list_resp = self.client.get("/api/vehicles/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(self._results(list_resp)), 1)

        search_resp = self.client.get("/api/vehicles/?search=AAA0001")
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(len(self._results(search_resp)), 1)

        patch_resp = self.client.patch(
            f"/api/vehicles/{vehicle_id}/",
            {"status": "INACTIVE"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data["status"], "INACTIVE")

        delete_resp = self.client.delete(f"/api/vehicles/{vehicle_id}/")
        self.assertEqual(delete_resp.status_code, 204)

    def test_vehicle_superadmin_requires_municipality(self):
        self.client.force_authenticate(self.superadmin)
        resp = self.client.post(
            "/api/vehicles/",
            {
                "license_plate": "SUP0001",
                "model": "Carro",
                "brand": "VW",
                "year": 2018,
                "max_passengers": 4,
                "odometer_current": 0,
                "odometer_initial": 0,
                "odometer_monthly_limit": 1000,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

        ok_resp = self.client.post(
            "/api/vehicles/",
            {
                "municipality": self.muni_a.id,
                "license_plate": "SUP0002",
                "model": "Carro",
                "brand": "VW",
                "year": 2018,
                "max_passengers": 4,
                "odometer_current": 0,
                "odometer_initial": 0,
                "odometer_monthly_limit": 1000,
            },
            format="json",
        )
        self.assertEqual(ok_resp.status_code, 201)

    def test_driver_crud_search_and_scoping(self):
        from drivers.models import Driver

        Driver.objects.create(
            municipality=self.muni_b,
            name="Motorista B",
            cpf="222.222.222-22",
            cnh_number="9999",
            cnh_category="D",
            cnh_expiration_date="2030-01-01",
            phone="11999999999",
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/drivers/",
            {
                "municipality": self.muni_a.id,
                "name": "Motorista A",
                "cpf": "111.111.111-11",
                "cnh_number": "12345",
                "cnh_category": "D",
                "cnh_expiration_date": "2030-01-01",
                "phone": "11888888888",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201, create_resp.data)
        driver_id = create_resp.data["id"]

        list_resp = self.client.get("/api/drivers/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(self._results(list_resp)), 1)

        search_resp = self.client.get("/api/drivers/?search=Motorista A")
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(len(self._results(search_resp)), 1)

        patch_resp = self.client.patch(
            f"/api/drivers/{driver_id}/",
            {"status": "INACTIVE"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data["status"], "INACTIVE")

        delete_resp = self.client.delete(f"/api/drivers/{driver_id}/")
        self.assertEqual(delete_resp.status_code, 204)

    def test_fuel_station_crud_search_and_scoping(self):
        FuelStation.objects.create(
            municipality=self.muni_b,
            name="Posto B",
            cnpj="00.000.000/0001-55",
            address="Rua B",
        )

        self.client.force_authenticate(self.admin_a)
        create_resp = self.client.post(
            "/api/vehicles/fuel_stations/",
            {
                "municipality": self.muni_a.id,
                "name": "Posto A",
                "cnpj": "00.000.000/0001-44",
                "address": "Rua A",
                "active": True,
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201, create_resp.data)
        station_id = create_resp.data["id"]

        list_resp = self.client.get("/api/vehicles/fuel_stations/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(self._results(list_resp)), 1)

        search_resp = self.client.get("/api/vehicles/fuel_stations/?search=Posto A")
        self.assertEqual(search_resp.status_code, 200)
        self.assertEqual(len(self._results(search_resp)), 1)

        patch_resp = self.client.patch(
            f"/api/vehicles/fuel_stations/{station_id}/",
            {"active": False},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertFalse(patch_resp.data["active"])

        delete_resp = self.client.delete(f"/api/vehicles/fuel_stations/{station_id}/")
        self.assertEqual(delete_resp.status_code, 204)

    def test_contract_filters_and_rental_period_close(self):
        contract_active = Contract.objects.create(
            municipality=self.muni_a,
            contract_number="CONT-001",
            type=Contract.Type.RENTAL,
            provider_name="Fornecedor A",
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timezone.timedelta(days=30),
            billing_model=Contract.BillingModel.PER_KM,
            base_value="0.00",
            extra_km_rate="2.50",
            status=Contract.Status.ACTIVE,
        )
        Contract.objects.create(
            municipality=self.muni_a,
            contract_number="CONT-002",
            type=Contract.Type.SERVICE,
            provider_name="Fornecedor B",
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timezone.timedelta(days=30),
            billing_model=Contract.BillingModel.FIXED,
            base_value="100.00",
            status=Contract.Status.INACTIVE,
        )
        Contract.objects.create(
            municipality=self.muni_b,
            contract_number="CONT-003",
            type=Contract.Type.LEASE,
            provider_name="Fornecedor C",
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timezone.timedelta(days=30),
            billing_model=Contract.BillingModel.FIXED,
            base_value="50.00",
            status=Contract.Status.ACTIVE,
        )

        self.client.force_authenticate(self.admin_a)
        list_active = self.client.get("/api/contracts/?status=ACTIVE")
        self.assertEqual(list_active.status_code, 200)
        self.assertEqual(len(self._results(list_active)), 1)

        list_provider = self.client.get("/api/contracts/?provider_name=Fornecedor A")
        self.assertEqual(list_provider.status_code, 200)
        self.assertEqual(len(self._results(list_provider)), 1)

        vehicle = Vehicle.objects.create(
            municipality=self.muni_a,
            license_plate="AAA9999",
            model="Van",
            brand="Ford",
            year=2020,
            max_passengers=10,
            odometer_current=100,
            odometer_initial=100,
            odometer_monthly_limit=500,
        )
        ContractVehicle.objects.create(
            contract=contract_active,
            municipality=self.muni_a,
            vehicle=vehicle,
            start_date=timezone.localdate(),
        )

        start_dt = timezone.now()
        create_period = self.client.post(
            "/api/rental-periods/",
            {
                "contract": contract_active.id,
                "vehicle": vehicle.id,
                "start_datetime": start_dt.isoformat(),
            },
            format="json",
        )
        self.assertEqual(create_period.status_code, 201)
        period_id = create_period.data["id"]

        close_resp = self.client.patch(
            f"/api/rental-periods/{period_id}/close/",
            {
                "end_datetime": (start_dt + timezone.timedelta(days=1)).isoformat(),
                "odometer_start": 100,
                "odometer_end": 150,
            },
            format="json",
        )
        self.assertEqual(close_resp.status_code, 200)
        self.assertEqual(close_resp.data["status"], "CLOSED")
        self.assertEqual(close_resp.data["billed_km"], "50.00")
