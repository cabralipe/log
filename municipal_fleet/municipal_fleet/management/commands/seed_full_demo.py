import random
import string
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from contracts.models import Contract, ContractVehicle, RentalPeriod
from drivers.models import Driver
from fleet.models import FuelLog, FuelStation, Vehicle, VehicleMaintenance
from tenants.models import Municipality
from trips.models import Trip, TripIncident


def random_plate(prefix: str, idx: int) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase, k=3))
    numbers = f"{idx:03d}"
    return f"{prefix}-{suffix}{numbers}"


def random_cnpj(idx: int) -> str:
    base2 = idx % 100
    base3a = idx % 1000
    base3b = (idx * 3) % 1000
    # Formato 00.000.000/0001-00 (18 chars)
    return f"{base2:02d}.{base3a:03d}.{base3b:03d}/0001-{base2:02d}"


def random_phone(idx: int) -> str:
    return f"1199{idx:02d}{random.randint(1000, 9999)}"


def random_name(prefix: str, idx: int) -> str:
    first = random.choice(["João", "Maria", "Ana", "Paulo", "Felipe", "Camila", "Bruna", "Rafael", "Igor", "Juliana"])
    last = random.choice(["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Almeida", "Ferraz", "Gomes"])
    return f"{prefix} {first} {last} {idx}"


def random_route():
    origins = ["Centro", "Terminal Norte", "Terminal Sul", "Prefeitura", "Rodoviária", "Zona Rural"]
    destinations = ["Escola Municipal", "UPA Central", "Hospital", "Secretaria de Saúde", "Obra Pública", "Ponto de Apoio"]
    return random.choice(origins), random.choice(destinations)


def random_datetime_within_days(days_back: int, days_forward: int) -> datetime:
    now = timezone.now()
    delta = timedelta(days=random.randint(-days_back, days_forward), hours=random.randint(0, 12))
    return now + delta


class Command(BaseCommand):
    help = "Gera uma base grande de dados de demonstração cobrindo todos os domínios (municípios, usuários, veículos, viagens, abastecimentos, contratos etc.)."

    def add_arguments(self, parser):
        parser.add_argument("--municipalities", type=int, default=3, help="Quantidade de prefeituras para popular (default: 3)")
        parser.add_argument("--vehicles-per-muni", type=int, default=15, help="Quantidade de veículos por prefeitura (default: 15)")
        parser.add_argument("--drivers-per-muni", type=int, default=20, help="Quantidade de motoristas por prefeitura (default: 20)")
        parser.add_argument("--trips-per-muni", type=int, default=200, help="Quantidade de viagens por prefeitura (default: 200)")

    def handle(self, *args, **options):
        muni_total = options["municipalities"]
        vehicles_per_muni = options["vehicles_per_muni"]
        drivers_per_muni = options["drivers_per_muni"]
        trips_per_muni = options["trips_per_muni"]
        UserModel = get_user_model()

        self.stdout.write(self.style.NOTICE("== Iniciando super populate =="))
        superadmin_email = "superadmin@example.com"
        superadmin, _ = UserModel.objects.get_or_create(
            email=superadmin_email,
            defaults={
                "role": User.Roles.SUPERADMIN,
                "first_name": "Super",
                "last_name": "Admin",
            },
        )
        superadmin.set_password("pass123")
        superadmin.save()
        self.stdout.write(self.style.SUCCESS(f"Superadmin disponível: {superadmin_email} / pass123"))

        for m in range(1, muni_total + 1):
            muni, _ = Municipality.objects.get_or_create(
                cnpj=random_cnpj(m),
                defaults={
                    "name": f"Prefeitura Demo {m}",
                    "address": f"Avenida Central {m*10}",
                    "city": f"Cidade {m}",
                    "state": "SP",
                    "phone": random_phone(m),
                },
            )
            self.stdout.write(self.style.SUCCESS(f"Municipio pronto: {muni.name}"))

            # Usuários base para a prefeitura
            for role, email_prefix in [
                (User.Roles.ADMIN_MUNICIPALITY, f"admin{m}@demo.gov"),
                (User.Roles.OPERATOR, f"operador{m}@demo.gov"),
                (User.Roles.VIEWER, f"viewer{m}@demo.gov"),
            ]:
                user, _ = UserModel.objects.get_or_create(
                    email=email_prefix,
                    defaults={
                        "role": role,
                        "municipality": muni,
                        "first_name": role.title(),
                        "last_name": f"Demo {m}",
                    },
                )
                user.set_password("pass123")
                user.save()

            # Combos base
            vehicles = []
            for v in range(vehicles_per_muni):
                plate = random_plate(f"MX{m}", v)
                vehicle, _ = Vehicle.objects.get_or_create(
                    municipality=muni,
                    license_plate=plate,
                    defaults={
                        "brand": random.choice(["Fiat", "VW", "Chevrolet", "Hyundai", "Renault"]),
                        "model": random.choice(["Uno", "Onix", "HB20", "Kwid", "Gol", "Duster"]),
                        "year": random.randint(2018, 2024),
                        "max_passengers": random.randint(4, 15),
                        "ownership_type": random.choice([c[0] for c in Vehicle.OwnershipType.choices]),
                        "status": random.choice([c[0] for c in Vehicle.Status.choices]),
                        "odometer_current": random.randint(20_000, 120_000),
                        "odometer_initial": random.randint(5_000, 10_000),
                        "odometer_monthly_limit": random.choice([0, 3000, 5000]),
                    },
                )
                vehicles.append(vehicle)

            fuel_stations = []
            for s in range(3):
                station, _ = FuelStation.objects.get_or_create(
                    municipality=muni,
                    name=f"Posto {muni.name[:3]} {s+1}",
                    defaults={"cnpj": random_cnpj(s + 50), "address": f"Rua do Combustível {s+1}", "active": True},
                )
                fuel_stations.append(station)

            drivers = []
            for d in range(drivers_per_muni):
                cpf = f"{m:03d}.{d:03d}.{random.randint(100,999)}-0{d%9}"  # 14 chars
                driver, _ = Driver.objects.get_or_create(
                    municipality=muni,
                    cpf=cpf,
                    defaults={
                        "name": random_name("Motorista", d),
                        "cnh_number": f"{random.randint(10000000, 99999999)}",
                        "cnh_category": random.choice(["B", "C", "D", "E"]),
                        "cnh_expiration_date": date.today() + timedelta(days=random.randint(180, 1600)),
                        "phone": random_phone(d),
                        "status": Driver.Status.ACTIVE,
                    },
                )
                drivers.append(driver)

            # Contratos e períodos
            contracts = []
            for c in range(2):
                start = date.today() - timedelta(days=365)
                end = date.today() + timedelta(days=random.randint(180, 720))
                contract, _ = Contract.objects.get_or_create(
                    municipality=muni,
                    contract_number=f"CTR-{m}-{c+1}",
                    defaults={
                        "description": f"Contrato demo {c+1}",
                        "type": random.choice([Contract.Type.LEASE, Contract.Type.RENTAL, Contract.Type.SERVICE]),
                        "provider_name": f"Fornecedor {c+1} LTDA",
                        "provider_cnpj": random_cnpj(200 + c),
                        "start_date": start,
                        "end_date": end,
                        "billing_model": random.choice([b[0] for b in Contract.BillingModel.choices]),
                        "base_value": Decimal(random.randint(10_000, 50_000)),
                        "included_km_per_month": random.choice([None, 2000, 4000]),
                        "extra_km_rate": Decimal("1.75"),
                        "status": Contract.Status.ACTIVE,
                        "notes": "Contrato gerado para carga de dados.",
                    },
                )
                contracts.append(contract)

            # Vincular veículos aos contratos
            for vehicle in vehicles:
                if random.random() < 0.7:
                    contract = random.choice(contracts)
                    cv, _ = ContractVehicle.objects.get_or_create(
                        contract=contract,
                        municipality=muni,
                        vehicle=vehicle,
                        defaults={"start_date": contract.start_date},
                    )
                    vehicle.current_contract = contract
                    vehicle.save(update_fields=["current_contract"])

            # Períodos de locação (alguns abertos, alguns fechados)
            rental_periods = []
            for contract in contracts:
                for _ in range(3):
                    start_dt = timezone.now() - timedelta(days=random.randint(20, 120))
                    end_dt = start_dt + timedelta(days=random.randint(3, 15))
                    vehicle = random.choice(vehicles)
                    rp = RentalPeriod.objects.create(
                        municipality=muni,
                        contract=contract,
                        vehicle=vehicle,
                        start_datetime=start_dt,
                        end_datetime=end_dt if random.random() > 0.3 else None,
                        odometer_start=random.randint(10_000, 80_000),
                        odometer_end=random.randint(80_000, 130_000) if random.random() > 0.3 else None,
                        status=random.choice([RentalPeriod.Status.OPEN, RentalPeriod.Status.CLOSED]),
                    )
                    rental_periods.append(rp)

            # Manutenções
            for vehicle in vehicles:
                for _ in range(random.randint(1, 3)):
                    VehicleMaintenance.objects.create(
                        vehicle=vehicle,
                        description=random.choice(["Troca de óleo", "Revisão geral", "Pastilha de freio", "Alinhamento"]),
                        date=date.today() - timedelta(days=random.randint(10, 200)),
                        mileage=vehicle.odometer_current - random.randint(200, 2000),
                    )

            # Viagens + incidentes + abastecimentos
            trips_created = []
            for i in range(trips_per_muni):
                vehicle = random.choice(vehicles)
                driver = random.choice(drivers)
                origin, destination = random_route()
                depart = random_datetime_within_days(days_back=120, days_forward=30)
                duration_hours = random.randint(1, 6)
                expected_return = depart + timedelta(hours=duration_hours)
                odometer_start = max(vehicle.odometer_current - random.randint(1000, 5000), 0)
                status = random.choices(
                    [Trip.Status.PLANNED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED],
                    weights=[0.2, 0.2, 0.6],
                )[0]
                odometer_end = None
                actual_return = None
                if status == Trip.Status.COMPLETED:
                    distance = random.randint(20, 180)
                    odometer_end = odometer_start + distance
                    actual_return = expected_return + timedelta(minutes=random.randint(-30, 90))
                    vehicle.odometer_current = max(vehicle.odometer_current, odometer_end)
                    vehicle.save(update_fields=["odometer_current"])

                passenger_count = random.randint(0, 12)
                passengers = []
                for p in range(passenger_count):
                    passengers.append(
                        {
                            "name": random_name("Passageiro", p),
                            "cpf": f"999.{p:03d}.{random.randint(100,999)}-0{p%9}",
                            "age": random.randint(6, 70),
                            "special_need": random.choice(["NONE", "ELDERLY", "PCD", "OTHER", "TEA"]),
                            "special_need_other": "Acompanhante" if random.random() < 0.1 else "",
                            "observation": "Transporte escolar" if random.random() < 0.2 else "",
                        }
                    )

                category = random.choice([Trip.Category.PASSENGER, Trip.Category.OBJECT, Trip.Category.MIXED])
                cargo_fields = {
                    "cargo_description": "Caixas de materiais",
                    "cargo_size": "Médio",
                    "cargo_quantity": random.randint(1, 20),
                    "cargo_purpose": "Entrega emergencial",
                }
                if category == Trip.Category.PASSENGER:
                    cargo_fields = {"cargo_description": "", "cargo_size": "", "cargo_quantity": 0, "cargo_purpose": ""}

                trip = Trip.objects.create(
                    municipality=muni,
                    vehicle=vehicle,
                    driver=driver,
                    contract=vehicle.current_contract,
                    rental_period=random.choice(rental_periods) if rental_periods else None,
                    origin=origin,
                    destination=destination,
                    departure_datetime=depart,
                    return_datetime_expected=expected_return,
                    return_datetime_actual=actual_return,
                    odometer_start=odometer_start,
                    odometer_end=odometer_end,
                    category=category,
                    passengers_count=len(passengers),
                    passengers_details=passengers,
                    stops_description="Pontos diversos na rota urbana.",
                    status=status,
                    notes="Gerado pelo script de populate.",
                    **cargo_fields,
                )
                trips_created.append(trip)

                if random.random() < 0.25:
                    TripIncident.objects.create(
                        municipality=muni,
                        trip=trip,
                        driver=driver,
                        description=random.choice(
                            [
                                "Atraso por trânsito intenso.",
                                "Passageiro faltou ao ponto.",
                                "Ocorrência leve na via, sem feridos.",
                                "Pneu precisou de calibragem extra.",
                            ]
                        ),
                    )

            # Abastecimentos
            for vehicle in vehicles:
                for _ in range(random.randint(2, 5)):
                    station = random.choice(fuel_stations)
                    FuelLog.objects.create(
                        municipality=muni,
                        vehicle=vehicle,
                        driver=random.choice(drivers),
                        filled_at=date.today() - timedelta(days=random.randint(1, 90)),
                        liters=Decimal(random.randint(20, 70)),
                        fuel_station=station.name,
                        fuel_station_ref=station,
                        notes="Abastecimento de teste.",
                    )

            self.stdout.write(
                self.style.SUCCESS(
                    f"[{muni.name}] Veículos: {len(vehicles)} | Motoristas: {len(drivers)} | Viagens: {len(trips_created)} | Postos: {len(fuel_stations)}"
                )
            )

        self.stdout.write(self.style.SUCCESS("Carga completa! Utilize 'pass123' para usuários gerados."))
