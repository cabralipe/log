import random
import string
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from contracts.models import Contract, ContractVehicle, RentalPeriod
from destinations.models import Destination
from drivers.models import Driver, DriverGeofence
from fleet.models import (
    FuelAlert,
    FuelInvoice,
    FuelInvoiceItem,
    FuelLog,
    FuelProduct,
    FuelRule,
    FuelStation,
    FuelStationLimit,
    Vehicle,
    VehicleInspection,
    VehicleMaintenance,
)
from forms.models import FormAnswer, FormOption, FormQuestion, FormSubmission, FormTemplate
from health.models import Companion, Patient
from maintenance.models import (
    InventoryMovement,
    InventoryPart,
    MaintenancePlan,
    ServiceOrder,
    ServiceOrderItem,
    ServiceOrderLabor,
    Tire,
    VehicleTire,
)
from notifications.models import Notification, NotificationDevice
from scheduling.models import DriverAvailabilityBlock, DriverWorkSchedule
from students.models import ClassGroup, School, Student, StudentCard, StudentTransportRegistration
from tenants.models import Municipality
from transport_planning.models import (
    Assignment,
    EligibilityPolicy,
    Person,
    Route,
    RouteStop,
    RouteUnit,
    ServiceApplication,
    ServiceUnit,
    TransportService,
)
from trips.models import FreeTrip, Trip, TripIncident


def random_plate(prefix: str, idx: int) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase, k=3))
    numbers = f"{idx:03d}"
    return f"{prefix}-{suffix}{numbers}"


def random_cnpj(idx: int) -> str:
    base2 = idx % 100
    base3a = idx % 1000
    base3b = (idx * 3) % 1000
    return f"{base2:02d}.{base3a:03d}.{base3b:03d}/0001-{base2:02d}"


def random_cpf(idx: int) -> str:
    part1 = idx % 1000
    part2 = (idx * 7) % 1000
    part3 = (idx * 13) % 1000
    return f"{part1:03d}.{part2:03d}.{part3:03d}-{idx%9}"


def random_phone(idx: int) -> str:
    return f"1199{idx:02d}{random.randint(1000, 9999)}"


def random_name(prefix: str, idx: int) -> str:
    first = random.choice(["Joao", "Maria", "Ana", "Paulo", "Felipe", "Camila", "Bruna", "Rafael", "Igor", "Juliana"])
    last = random.choice(["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Almeida", "Ferraz", "Gomes"])
    return f"{prefix} {first} {last} {idx}"


def random_route():
    origins = ["Centro", "Terminal Norte", "Terminal Sul", "Prefeitura", "Rodoviaria", "Zona Rural"]
    destinations = ["Escola Municipal", "UPA Central", "Hospital", "Secretaria de Saude", "Obra Publica", "Ponto de Apoio"]
    return random.choice(origins), random.choice(destinations)


def aware_datetime_for_day(day: date, hour: int | None = None, minute: int | None = None) -> datetime:
    hour = hour if hour is not None else random.randint(5, 22)
    minute = minute if minute is not None else random.randint(0, 59)
    base = datetime.combine(day, time(hour=hour, minute=minute))
    return timezone.make_aware(base, timezone=timezone.get_current_timezone())


def get_first_or_create(model, defaults=None, **kwargs):
    """
    Helper to get the first object matching kwargs or create a new one.
    Avoids MultipleObjectsReturned error if duplicates exist.
    """
    obj = model.objects.filter(**kwargs).first()
    if obj:
        return obj, False
    return model.objects.create(**kwargs, **(defaults or {})), True


class Command(BaseCommand):
    help = (
        "Gera uma base completa de dados de demonstração cobrindo todos os domínios "
        "(saude, educacao, frota, viagens, combustivel, contratos, manutencao, formularios, planejamento, "
        "agendamentos e notificacoes)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--municipalities", type=int, default=2, help="Quantidade de prefeituras (default: 2)")
        parser.add_argument("--vehicles-per-muni", type=int, default=8, help="Veiculos por prefeitura (default: 8)")
        parser.add_argument("--drivers-per-muni", type=int, default=10, help="Motoristas por prefeitura (default: 10)")
        parser.add_argument("--trips-per-muni", type=int, default=30, help="Viagens por prefeitura (default: 30)")
        parser.add_argument("--students-per-muni", type=int, default=20, help="Alunos por prefeitura (default: 20)")
        parser.add_argument("--patients-per-muni", type=int, default=12, help="Pacientes por prefeitura (default: 12)")
        parser.add_argument("--forms-per-muni", type=int, default=10, help="Submissoes de formularios (default: 10)")
        parser.add_argument("--routes-per-muni", type=int, default=3, help="Rotas por prefeitura (default: 3)")
        parser.add_argument("--scale", type=int, default=1, help="Multiplicador de volume (default: 1)")

    def handle(self, *args, **options):
        random.seed(42)
        scale = max(int(options["scale"]), 1)
        muni_total = options["municipalities"]
        vehicles_per_muni = options["vehicles_per_muni"] * scale
        drivers_per_muni = options["drivers_per_muni"] * scale
        trips_per_muni = options["trips_per_muni"] * scale
        students_per_muni = options["students_per_muni"] * scale
        patients_per_muni = options["patients_per_muni"] * scale
        forms_per_muni = options["forms_per_muni"] * scale
        routes_per_muni = options["routes_per_muni"] * scale
        UserModel = get_user_model()

        self.stdout.write(self.style.NOTICE("== Super populate completo em execucao =="))
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
        self.stdout.write(self.style.SUCCESS(f"Superadmin disponivel: {superadmin_email} / pass123"))

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

            user_roles = {}
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
                user_roles[role] = user

            destinations = []
            for idx, dest_type in enumerate(
                [Destination.DestinationType.SCHOOL, Destination.DestinationType.HEALTH_UNIT, Destination.DestinationType.OTHER]
            ):
                dest, _ = Destination.objects.get_or_create(
                    municipality=muni,
                    name=f"Destino {m}-{idx+1}",
                    defaults={
                        "type": dest_type,
                        "address": f"Rua Destino {idx+1}",
                        "district": "Centro",
                        "city": muni.city,
                        "state": "SP",
                        "postal_code": "00000-000",
                        "latitude": Decimal("-23.5") + Decimal(idx) / Decimal("100"),
                        "longitude": Decimal("-46.6") - Decimal(idx) / Decimal("100"),
                        "notes": "Gerado pelo super populate.",
                    },
                )
                destinations.append(dest)

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
                        "max_passengers": random.randint(4, 18),
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
                    defaults={"cnpj": random_cnpj(s + 50), "address": f"Rua do Combustivel {s+1}", "active": True},
                )
                fuel_stations.append(station)

            fuel_products = []
            for prod_name in ["Gasolina", "Diesel", "Etanol"]:
                product, _ = FuelProduct.objects.get_or_create(
                    municipality=muni,
                    name=prod_name,
                    defaults={"unit": FuelProduct.Unit.LITER, "active": True},
                )
                fuel_products.append(product)

            drivers = []
            for d in range(drivers_per_muni):
                cpf = random_cpf(d + m * 10)
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

            for driver in drivers[: max(1, len(drivers) // 3)]:
                DriverGeofence.objects.get_or_create(
                    driver=driver,
                    defaults={
                        "center_lat": Decimal("-23.55"),
                        "center_lng": Decimal("-46.63"),
                        "radius_m": 1000,
                        "is_active": True,
                        "alert_active": False,
                    },
                )

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
                        "notes": "Contrato gerado pelo super populate.",
                    },
                )
                contracts.append(contract)

            for station in fuel_stations:
                for product in fuel_products:
                    FuelStationLimit.objects.get_or_create(
                        municipality=muni,
                        fuel_station=station,
                        contract=random.choice(contracts) if contracts else None,
                        product=product,
                        period=FuelStationLimit.Period.MONTHLY,
                        defaults={"max_quantity": Decimal("5000.00")},
                    )

            for vehicle in vehicles:
                if random.random() < 0.7:
                    contract = random.choice(contracts)
                    ContractVehicle.objects.get_or_create(
                        contract=contract,
                        municipality=muni,
                        vehicle=vehicle,
                        defaults={"start_date": contract.start_date},
                    )
                    vehicle.current_contract = contract
                    vehicle.save(update_fields=["current_contract"])
                FuelRule.objects.get_or_create(
                    municipality=muni,
                    scope=FuelRule.Scope.VEHICLE,
                    vehicle=vehicle,
                    defaults={"allowed_weekdays": [0, 1, 2, 3, 4], "active": True},
                )

            rental_periods = []
            for contract in contracts:
                for _ in range(2):
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

            for vehicle in vehicles:
                for _ in range(random.randint(1, 2)):
                    VehicleMaintenance.objects.create(
                        vehicle=vehicle,
                        description=random.choice(["Troca de oleo", "Revisao geral", "Pastilha de freio", "Alinhamento"]),
                        date=date.today() - timedelta(days=random.randint(10, 200)),
                        mileage=vehicle.odometer_current - random.randint(200, 2000),
                    )

            inventory_part, _ = InventoryPart.objects.get_or_create(
                municipality=muni,
                sku=f"FLT-{m}",
                defaults={
                    "name": "Filtro de oleo",
                    "unit": "UN",
                    "minimum_stock": Decimal("5"),
                    "current_stock": Decimal("20"),
                    "average_cost": Decimal("25.00"),
                },
            )
            get_first_or_create(
                InventoryMovement,
                municipality=muni,
                part=inventory_part,
                type=InventoryMovement.MovementType.IN,
                reference="Entrada inicial",
                defaults={
                    "quantity": Decimal("10"),
                    "unit_cost": Decimal("20.00"),
                    "performed_by": user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                },
            )
            get_first_or_create(
                MaintenancePlan,
                municipality=muni,
                vehicle=random.choice(vehicles),
                name="Revisao 10k",
                defaults={
                    "trigger_type": MaintenancePlan.TriggerType.KM,
                    "interval_km": 10000,
                    "last_service_odometer": random.randint(10_000, 50_000),
                    "last_service_date": date.today() - timedelta(days=120),
                },
            )
            service_order, _ = get_first_or_create(
                ServiceOrder,
                municipality=muni,
                description="Servico gerado pelo super populate",
                defaults={
                    "vehicle": random.choice(vehicles),
                    "opened_by": user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                    "type": ServiceOrder.Type.CORRECTIVE,
                    "priority": ServiceOrder.Priority.MEDIUM,
                    "vehicle_odometer_open": random.randint(10_000, 80_000),
                },
            )
            get_first_or_create(
                ServiceOrderItem,
                service_order=service_order,
                part=inventory_part,
                defaults={
                    "quantity": Decimal("2"),
                    "unit_cost": Decimal("30.00"),
                },
            )
            get_first_or_create(
                ServiceOrderLabor,
                service_order=service_order,
                description="Mao de obra",
                defaults={
                    "hours": Decimal("2.5"),
                    "hourly_rate": Decimal("80.00"),
                },
            )
            tire, _ = Tire.objects.get_or_create(
                municipality=muni,
                code=f"TIRE-{m}",
                defaults={
                    "brand": "Goodyear",
                    "model": "G1",
                    "size": "195/65R15",
                    "purchase_date": date.today() - timedelta(days=200),
                    "purchase_price": Decimal("450.00"),
                },
            )
            get_first_or_create(
                VehicleTire,
                tire=tire,
                defaults={
                    "vehicle": random.choice(vehicles),
                    "position": VehicleTire.Position.FRONT_LEFT,
                    "installed_odometer": random.randint(10_000, 60_000),
                },
            )

            patients = []
            for p in range(patients_per_muni):
                patient, _ = Patient.objects.get_or_create(
                    municipality=muni,
                    cpf=random_cpf(p + 100),
                    defaults={
                        "full_name": random_name("Paciente", p),
                        "date_of_birth": date.today() - timedelta(days=365 * random.randint(18, 80)),
                        "needs_companion": random.random() < 0.4,
                        "status": Patient.Status.ACTIVE,
                    },
                )
                patients.append(patient)
                if patient.needs_companion:
                    Companion.objects.get_or_create(
                        municipality=muni,
                        patient=patient,
                        cpf=random_cpf(p + 200),
                        defaults={
                            "full_name": random_name("Acompanhante", p),
                            "phone": random_phone(p),
                            "active": True,
                        },
                    )

            schools = []
            class_groups = []
            for s in range(max(2, students_per_muni // 10)):
                school, _ = School.objects.get_or_create(
                    municipality=muni,
                    name=f"Escola Demo {m}-{s+1}",
                    defaults={
                        "address": f"Rua Escola {s+1}",
                        "city": muni.city,
                        "district": "Centro",
                        "phone": random_phone(s),
                        "type": School.SchoolType.MUNICIPAL,
                        "is_active": True,
                        "destination": destinations[0] if destinations else None,
                    },
                )
                schools.append(school)
                class_groups.append(
                    ClassGroup.objects.get_or_create(
                        municipality=muni,
                        school=school,
                        name=f"Turma {s+1}A",
                        defaults={
                            "shift": Student.Shift.MORNING,
                            "active": True,
                        },
                    )[0]
                )

            students = []
            for s in range(students_per_muni):
                school = random.choice(schools)
                class_group = random.choice(class_groups)
                student, _ = Student.objects.get_or_create(
                    municipality=muni,
                    cpf=random_cpf(s + 300),
                    defaults={
                        "school": school,
                        "class_group": class_group,
                        "full_name": random_name("Aluno", s),
                        "date_of_birth": date.today() - timedelta(days=365 * random.randint(7, 18)),
                        "shift": random.choice([c[0] for c in Student.Shift.choices]),
                        "status": Student.Status.ACTIVE,
                        "address": f"Rua {s+1}",
                        "district": "Bairro",
                    },
                )
                students.append(student)

            student_cards = []
            for idx, student in enumerate(students[: max(1, students_per_muni // 2)]):
                card, _ = StudentCard.objects.get_or_create(
                    municipality=muni,
                    card_number=f"CARD-{m}-{idx+1}",
                    defaults={
                        "student": student,
                        "issue_date": date.today() - timedelta(days=30),
                        "expiration_date": date.today() + timedelta(days=365),
                        "status": StudentCard.Status.ACTIVE,
                        "qr_payload": f"QR-{m}-{idx+1}",
                    },
                )
                student_cards.append(card)

            for student in students[: max(1, students_per_muni // 3)]:
                StudentTransportRegistration.objects.create(
                    municipality=muni,
                    student=student,
                    school=student.school,
                    pickup_address=f"Rua {student.id} A",
                    pickup_district="Bairro A",
                    dropoff_address=f"Rua {student.id} B",
                    dropoff_district="Bairro B",
                    shift=student.shift,
                    days_of_week=["MON", "TUE", "WED", "THU", "FRI"],
                    route_name="Rota Escolar",
                    status=StudentTransportRegistration.Status.ACTIVE,
                    valid_from=date.today() - timedelta(days=10),
                    valid_until=date.today() + timedelta(days=365),
                )

            student_form, _ = FormTemplate.objects.get_or_create(
                municipality=muni,
                name="Formulario Carteirinha",
                defaults={
                    "description": "Solicitacao de carteirinha",
                    "form_type": FormTemplate.FormType.STUDENT_CARD_APPLICATION,
                    "is_active": True,
                },
            )
            if not student_form.questions.exists():
                get_first_or_create(
                    FormQuestion,
                    form_template=student_form,
                    order=1,
                    label="Nome completo",
                    defaults={
                        "field_name": "full_name",
                        "type": FormQuestion.QuestionType.SHORT_TEXT,
                        "required": True,
                    },
                )
                get_first_or_create(
                    FormQuestion,
                    form_template=student_form,
                    order=2,
                    label="CPF",
                    defaults={
                        "field_name": "cpf",
                        "type": FormQuestion.QuestionType.SHORT_TEXT,
                        "required": True,
                    },
                )

            transport_form, _ = FormTemplate.objects.get_or_create(
                municipality=muni,
                name="Formulario Transporte",
                defaults={
                    "description": "Solicitacao de transporte",
                    "form_type": FormTemplate.FormType.TRANSPORT_REQUEST,
                    "is_active": True,
                    "require_cpf": True,
                },
            )
            if not transport_form.questions.exists():
                reason_question, _ = get_first_or_create(
                    FormQuestion,
                    form_template=transport_form,
                    order=1,
                    label="Motivo",
                    defaults={
                        "field_name": "reason",
                        "type": FormQuestion.QuestionType.DROPDOWN,
                        "required": True,
                    },
                )
                for idx, label in enumerate(["Saude", "Educacao", "Assistencia"]):
                    get_first_or_create(
                        FormOption,
                        question=reason_question,
                        label=label,
                        defaults={
                            "value": label.lower(),
                            "order": idx,
                        },
                    )
                get_first_or_create(
                    FormQuestion,
                    form_template=transport_form,
                    order=2,
                    label="Endereco",
                    defaults={
                        "field_name": "address",
                        "type": FormQuestion.QuestionType.SHORT_TEXT,
                        "required": True,
                    },
                )

            for idx in range(forms_per_muni):
                student = random.choice(students)
                card = random.choice(student_cards) if student_cards else None
                submission, _ = get_first_or_create(
                    FormSubmission,
                    form_template=student_form,
                    municipality=muni,
                    cpf=student.cpf,
                    defaults={
                        "status": FormSubmission.Status.APPROVED,
                        "linked_student": student,
                        "linked_student_card": card,
                    },
                )
                for question in student_form.questions.all():
                    get_first_or_create(
                        FormAnswer,
                        submission=submission,
                        question=question,
                        defaults={
                            "value_text": student.full_name if question.field_name == "full_name" else student.cpf,
                        },
                    )

            service_unit, _ = ServiceUnit.objects.get_or_create(
                municipality=muni,
                name=f"Unidade Servico {m}",
                defaults={
                    "unit_type": ServiceUnit.UnitType.SCHOOL,
                    "address": "Rua da Unidade",
                    "lat": Decimal("-23.55"),
                    "lng": Decimal("-46.63"),
                    "active": True,
                },
            )
            transport_service, _ = TransportService.objects.get_or_create(
                municipality=muni,
                name=f"Transporte Escolar {m}",
                defaults={
                    "service_type": TransportService.ServiceType.SCHEDULED,
                    "description": "Servico de transporte escolar",
                    "requires_authorization": True,
                    "active": True,
                    "form_template": transport_form,
                },
            )
            routes = []
            for r in range(routes_per_muni):
                route, _ = Route.objects.get_or_create(
                    municipality=muni,
                    code=f"R{m}-{r+1}",
                    defaults={
                        "transport_service": transport_service,
                        "name": f"Rota {r+1}",
                        "route_type": Route.RouteType.URBAN,
                        "days_of_week": ["MON", "TUE", "WED", "THU", "FRI"],
                        "time_window_start": time(7, 0),
                        "time_window_end": time(9, 0),
                        "estimated_duration_minutes": 60,
                        "planned_capacity": 20,
                        "active": True,
                        "contract": random.choice(contracts) if contracts else None,
                        "notes": "Rota gerada pelo super populate.",
                    },
                )
                RouteUnit.objects.get_or_create(route=route, service_unit=service_unit, municipality=muni)
                get_first_or_create(
                    RouteStop,
                    municipality=muni,
                    route=route,
                    order=1,
                    defaults={
                        "description": "Ponto 1",
                        "lat": Decimal("-23.56"),
                        "lng": Decimal("-46.64"),
                        "stop_type": RouteStop.StopType.PICKUP,
                        "scheduled_time": time(7, 15),
                    },
                )
                get_first_or_create(
                    RouteStop,
                    municipality=muni,
                    route=route,
                    order=2,
                    defaults={
                        "description": "Ponto 2",
                        "lat": Decimal("-23.57"),
                        "lng": Decimal("-46.65"),
                        "stop_type": RouteStop.StopType.DROPOFF,
                        "scheduled_time": time(8, 10),
                    },
                )
                routes.append(route)

            policy, _ = get_first_or_create(
                EligibilityPolicy,
                municipality=muni,
                transport_service=transport_service,
                name="Politica padrao",
                defaults={
                    "route": routes[0] if routes else None,
                    "rules_json": {"age_min": 6, "age_max": 18},
                    "decision_mode": EligibilityPolicy.DecisionMode.MANUAL_REVIEW_ONLY,
                    "active": True,
                },
            )
            person, _ = Person.objects.get_or_create(
                municipality=muni,
                cpf=random_cpf(m + 400),
                defaults={
                    "full_name": random_name("Pessoa", m),
                    "date_of_birth": date.today() - timedelta(days=365 * random.randint(8, 60)),
                    "phone": random_phone(m),
                    "address": "Rua Pessoa",
                    "district": "Centro",
                    "categories": ["STUDENT"],
                    "status": Person.Status.ACTIVE,
                },
            )
            transport_submission, _ = get_first_or_create(
                FormSubmission,
                form_template=transport_form,
                municipality=muni,
                cpf=person.cpf,
                defaults={
                    "status": FormSubmission.Status.PENDING,
                },
            )
            for question in transport_form.questions.all():
                value = "Saude" if question.field_name == "reason" else person.address
                get_first_or_create(
                    FormAnswer,
                    submission=transport_submission,
                    question=question,
                    defaults={
                        "value_text": value,
                    },
                )
            get_first_or_create(
                ServiceApplication,
                municipality=muni,
                person=person,
                transport_service=transport_service,
                defaults={
                    "route": routes[0] if routes else None,
                    "form_submission": transport_submission,
                    "status": ServiceApplication.Status.PENDING,
                    "status_notes": "Gerado pelo super populate.",
                    "correction_deadline": date.today() + timedelta(days=15),
                },
            )
            if routes:
                get_first_or_create(
                    Assignment,
                    municipality=muni,
                    route=routes[0],
                    date=date.today(),
                    defaults={
                        "vehicle": random.choice(vehicles),
                        "driver": random.choice(drivers),
                        "status": Assignment.Status.CONFIRMED,
                        "notes": "Escala gerada pelo super populate.",
                    },
                )

            for d in drivers[:2]:
                DriverWorkSchedule.objects.get_or_create(
                    municipality=muni,
                    driver=d,
                    weekday=1,
                    start_time=time(8, 0),
                    end_time=time(12, 0),
                )
                DriverAvailabilityBlock.objects.get_or_create(
                    municipality=muni,
                    driver=d,
                    type=DriverAvailabilityBlock.BlockType.DAY_OFF,
                    start_datetime=aware_datetime_for_day(date.today(), 13, 0),
                    end_datetime=aware_datetime_for_day(date.today(), 18, 0),
                    status=DriverAvailabilityBlock.Status.ACTIVE,
                    reason="Bloqueio gerado pelo super populate.",
                    created_by=user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                )

            for i in range(trips_per_muni):
                vehicle = random.choice(vehicles)
                driver = random.choice(drivers)
                origin, destination = random_route()
                depart = timezone.now() - timedelta(days=random.randint(1, 60))
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

                trip, _ = get_first_or_create(
                    Trip,
                    municipality=muni,
                    vehicle=vehicle,
                    driver=driver,
                    departure_datetime=depart,
                    defaults={
                        "contract": vehicle.current_contract,
                        "rental_period": random.choice(rental_periods) if rental_periods else None,
                        "origin": origin,
                        "destination": destination,
                        "return_datetime_expected": expected_return,
                        "return_datetime_actual": actual_return,
                        "odometer_start": odometer_start,
                        "odometer_end": odometer_end,
                        "category": random.choice([Trip.Category.PASSENGER, Trip.Category.OBJECT, Trip.Category.MIXED]),
                        "passengers_count": random.randint(0, 12),
                        "passengers_details": [],
                        "status": status,
                        "notes": "Gerado pelo super populate.",
                    },
                )
                if random.random() < 0.2:
                    get_first_or_create(
                        TripIncident,
                        municipality=muni,
                        trip=trip,
                        defaults={
                            "driver": driver,
                            "description": "Ocorrencia gerada pelo super populate.",
                        },
                    )

            for vehicle in vehicles:
                for _ in range(random.randint(1, 3)):
                    station = random.choice(fuel_stations)
                    fuel_log, _ = get_first_or_create(
                        FuelLog,
                        municipality=muni,
                        vehicle=vehicle,
                        filled_at=date.today() - timedelta(days=random.randint(1, 90)),
                        defaults={
                            "driver": random.choice(drivers),
                            "liters": Decimal(random.randint(20, 70)),
                            "price_per_liter": Decimal("5.15"),
                            "fuel_station": station.name,
                            "fuel_station_ref": station,
                            "product": random.choice(fuel_products) if fuel_products else None,
                            "odometer": vehicle.odometer_current + random.randint(10, 120),
                            "notes": "Abastecimento de teste.",
                        },
                    )
                    get_first_or_create(
                        FuelAlert,
                        municipality=muni,
                        fuel_log=fuel_log,
                        defaults={
                            "alert_type": "HIGH_CONSUMPTION",
                            "severity": FuelAlert.Severity.MEDIUM,
                            "message": "Alerta gerado pelo super populate.",
                            "trip": Trip.objects.filter(vehicle=vehicle).first(),
                        },
                    )

            if fuel_stations and fuel_products:
                invoice, _ = get_first_or_create(
                    FuelInvoice,
                    municipality=muni,
                    fuel_station=fuel_stations[0],
                    period_start=date.today() - timedelta(days=30),
                    period_end=date.today(),
                    defaults={
                        "total_value": Decimal("12000.00"),
                    },
                )
                get_first_or_create(
                    FuelInvoiceItem,
                    invoice=invoice,
                    ticket_number=f"NF-{muni.id}-{fuel_stations[0].id}",
                    defaults={
                        "occurred_at": timezone.now() - timedelta(days=5),
                        "product": fuel_products[0],
                        "quantity": Decimal("1200.00"),
                        "unit_price": Decimal("5.00"),
                        "total_value": Decimal("6000.00"),
                        "matched_fuel_log": FuelLog.objects.filter(fuel_station_ref=fuel_stations[0]).first(),
                    },
                )

            for driver in drivers[:3]:
                get_first_or_create(
                    FreeTrip,
                    municipality=muni,
                    driver=driver,
                    started_at=timezone.now() - timedelta(days=2),
                    defaults={
                        "vehicle": random.choice(vehicles),
                        "ended_at": timezone.now() - timedelta(days=1),
                        "odometer_start": random.randint(10_000, 80_000),
                        "odometer_end": random.randint(80_000, 130_000),
                        "status": FreeTrip.Status.CLOSED,
                    },
                )

            for vehicle in vehicles[: max(1, len(vehicles) // 2)]:
                get_first_or_create(
                    VehicleInspection,
                    municipality=muni,
                    vehicle=vehicle,
                    inspection_date=date.today() - timedelta(days=random.randint(1, 30)),
                    defaults={
                        "driver": random.choice(drivers),
                        "odometer": vehicle.odometer_current,
                        "checklist_items": [{"item": "Pneus", "status": "OK"}],
                        "notes": "Inspecao gerada pelo super populate.",
                        "condition_status": VehicleInspection.ConditionStatus.OK,
                        "signature_name": "Motorista Demo",
                    },
                )

            get_first_or_create(
                Notification,
                municipality=muni,
                recipient_user=user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                channel=Notification.Channel.IN_APP,
                event_type="FUEL_ALERT",
                defaults={
                    "title": "Alerta de combustivel",
                    "message": "Consumo acima do esperado.",
                    "metadata": {"source": "superpopulate"},
                    "is_read": False,
                    "sent_at": timezone.now(),
                },
            )
            get_first_or_create(
                Notification,
                municipality=muni,
                recipient_driver=random.choice(drivers),
                channel=Notification.Channel.PUSH,
                event_type="TRIP_UPDATE",
                defaults={
                    "title": "Nova viagem",
                    "message": "Uma nova viagem foi atribuida.",
                    "metadata": {"source": "superpopulate"},
                    "is_read": False,
                    "sent_at": timezone.now(),
                },
            )
            get_first_or_create(
                NotificationDevice,
                municipality=muni,
                user=user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                device_type=NotificationDevice.DeviceType.WEB,
                defaults={
                    "token": f"token-{muni.id}-{random.randint(1000,9999)}",
                    "active": True,
                },
            )
            get_first_or_create(
                NotificationDevice,
                municipality=muni,
                driver=random.choice(drivers),
                device_type=NotificationDevice.DeviceType.ANDROID,
                defaults={
                    "token": f"driver-token-{muni.id}-{random.randint(1000,9999)}",
                    "active": True,
                },
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"[{muni.name}] Veiculos: {len(vehicles)} | Motoristas: {len(drivers)} | "
                    f"Alunos: {len(students)} | Pacientes: {len(patients)} | Rotas: {len(routes)}"
                )
            )

        self.stdout.write(self.style.SUCCESS("Super populate completo concluido! Senha padrao: pass123"))
