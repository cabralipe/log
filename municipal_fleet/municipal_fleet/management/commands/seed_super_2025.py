import random
import string
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from contracts.models import Contract, ContractVehicle, RentalPeriod
from drivers.models import Driver
from fleet.models import FuelLog, FuelStation, Vehicle, VehicleMaintenance
from forms.models import FormAnswer, FormOption, FormQuestion, FormSubmission, FormTemplate
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
from students.models import School, Student, StudentCard, StudentTransportRegistration
from tenants.models import Municipality
from transport_planning.models import (
    Assignment,
    EligibilityPolicy,
    Person,
    Route,
    RouteStop,
    ServiceApplication,
    ServiceUnit,
    TransportService,
)
from trips.models import FreeTrip, MonthlyOdometer, Trip, TripIncident


def random_plate(prefix: str, idx: int) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase, k=3))
    numbers = f"{idx:03d}"
    return f"{prefix}-{suffix}{numbers}"


def random_cnpj(idx: int) -> str:
    base2 = idx % 100
    base3a = idx % 1000
    base3b = (idx * 3) % 1000
    return f"{base2:02d}.{base3a:03d}.{base3b:03d}/0001-{base2:02d}"


def random_phone(idx: int) -> str:
    return f"1199{idx:02d}{random.randint(1000, 9999)}"


def random_name(prefix: str, idx: int) -> str:
    first = random.choice(["João", "Maria", "Ana", "Paulo", "Felipe", "Camila", "Bruna", "Rafael", "Igor", "Juliana"])
    last = random.choice(["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Almeida", "Ferraz", "Gomes"])
    return f"{prefix} {first} {last} {idx}"


def aware_datetime_for_day(day: date, hour: int | None = None, minute: int | None = None) -> datetime:
    hour = hour if hour is not None else random.randint(5, 22)
    minute = minute if minute is not None else random.randint(0, 59)
    base = datetime.combine(day, time(hour=hour, minute=minute))
    return timezone.make_aware(base, timezone=timezone.get_current_timezone())


class Command(BaseCommand):
    help = (
        "Gera uma carga massiva (super populate) para o ano inteiro de 2025 cobrindo todos os domínios da plataforma. "
        "Cria dados em grande volume para municípios, usuários, veículos, viagens diárias, manutenções, "
        "contratos, abastecimentos, formulários, cadastros de estudantes, planejamento de transporte e estoque."
    )

    def add_arguments(self, parser):
        parser.add_argument("--municipalities", type=int, default=5, help="Quantidade de prefeituras (default: 5)")
        parser.add_argument("--vehicles-per-muni", type=int, default=30, help="Veículos por prefeitura (default: 30)")
        parser.add_argument("--drivers-per-muni", type=int, default=60, help="Motoristas por prefeitura (default: 60)")
        parser.add_argument(
            "--trips-per-day",
            type=int,
            default=8,
            help="Viagens criadas por dia em 2025 para cada prefeitura (default: 8, gera >2.900 viagens/município).",
        )
        parser.add_argument(
            "--students-per-muni",
            type=int,
            default=120,
            help="Cadastros de estudantes por prefeitura para cobrir formulários/cartões (default: 120)",
        )
        parser.add_argument(
            "--forms-per-muni",
            type=int,
            default=80,
            help="Envios de formulários simulados por prefeitura (default: 80)",
        )

    def handle(self, *args, **options):
        year = 2025
        start_day = date(year, 1, 1)
        end_day = date(year, 12, 31)
        total_days = (end_day - start_day).days + 1
        muni_total = options["municipalities"]
        vehicles_per_muni = options["vehicles_per_muni"]
        drivers_per_muni = options["drivers_per_muni"]
        trips_per_day = options["trips_per_day"]
        students_per_muni = options["students_per_muni"]
        forms_per_muni = options["forms_per_muni"]
        UserModel = get_user_model()

        self.stdout.write(self.style.NOTICE("== Super populate 2025 em execução (volume massivo) =="))
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
                    "name": f"Prefeitura Mega Demo {m}",
                    "address": f"Avenida Central {m*10}",
                    "city": f"Cidade Mega {m}",
                    "state": "SP",
                    "phone": random_phone(m),
                },
            )
            self.stdout.write(self.style.SUCCESS(f"Município pronto: {muni.name}"))

            # Usuários chave
            user_roles = {}
            for role, email_prefix in [
                (User.Roles.ADMIN_MUNICIPALITY, f"admin{m}@mega.gov"),
                (User.Roles.OPERATOR, f"operador{m}@mega.gov"),
                (User.Roles.VIEWER, f"viewer{m}@mega.gov"),
            ]:
                user, _ = UserModel.objects.get_or_create(
                    email=email_prefix,
                    defaults={
                        "role": role,
                        "municipality": muni,
                        "first_name": role.title(),
                        "last_name": f"Mega {m}",
                    },
                )
                user.set_password("pass123")
                user.save()
                user_roles[role] = user

            # Veículos
            vehicles = []
            for v in range(vehicles_per_muni):
                plate = random_plate(f"MX{m}", v)
                vehicle, _ = Vehicle.objects.get_or_create(
                    municipality=muni,
                    license_plate=plate,
                    defaults={
                        "brand": random.choice(["Fiat", "VW", "Chevrolet", "Hyundai", "Renault"]),
                        "model": random.choice(["Uno", "Onix", "HB20", "Kwid", "Gol", "Duster"]),
                        "year": random.randint(2017, 2024),
                        "max_passengers": random.randint(4, 20),
                        "ownership_type": random.choice([c[0] for c in Vehicle.OwnershipType.choices]),
                        "status": random.choice([c[0] for c in Vehicle.Status.choices]),
                        "odometer_current": random.randint(25_000, 180_000),
                        "odometer_initial": random.randint(5_000, 15_000),
                        "odometer_monthly_limit": random.choice([0, 2500, 4000, 6000]),
                        "last_service_date": start_day - timedelta(days=random.randint(15, 120)),
                        "next_service_date": start_day + timedelta(days=random.randint(30, 90)),
                        "last_oil_change_date": start_day - timedelta(days=random.randint(10, 90)),
                        "next_oil_change_date": start_day + timedelta(days=random.randint(45, 120)),
                    },
                )
                vehicles.append(vehicle)

            # Postos de combustível
            fuel_stations = []
            for s in range(5):
                station, _ = FuelStation.objects.get_or_create(
                    municipality=muni,
                    name=f"Posto {muni.name[:4]} {s+1}",
                    defaults={"cnpj": random_cnpj(s + 40), "address": f"Rua do Combustível {s+1}", "active": True},
                )
                fuel_stations.append(station)

            # Motoristas
            drivers = []
            for d in range(drivers_per_muni):
                cpf = f"{m:03d}.{d:03d}.{random.randint(100,999)}-0{d%9}"
                driver, _ = Driver.objects.get_or_create(
                    municipality=muni,
                    cpf=cpf,
                    defaults={
                        "name": random_name("Motorista", d),
                        "cnh_number": f"{random.randint(10000000, 99999999)}",
                        "cnh_category": random.choice(["B", "C", "D", "E"]),
                        "cnh_expiration_date": date.today() + timedelta(days=random.randint(180, 1600)),
                        "phone": random_phone(d),
                        "status": random.choice([Driver.Status.ACTIVE, Driver.Status.INACTIVE]),
                        "free_trip_enabled": random.random() < 0.5,
                    },
                )
                drivers.append(driver)

            # Contratos e vínculos
            contracts = []
            for c in range(3):
                start = date(year - 1, random.randint(6, 12), random.randint(1, 28))
                end = date(year + 1, random.randint(1, 12), random.randint(1, 28))
                contract, _ = Contract.objects.get_or_create(
                    municipality=muni,
                    contract_number=f"CTR-{m}-{c+1}",
                    defaults={
                        "description": f"Contrato mega demo {c+1}",
                        "type": random.choice([Contract.Type.LEASE, Contract.Type.RENTAL, Contract.Type.SERVICE]),
                        "provider_name": f"Fornecedor {c+1} LTDA",
                        "provider_cnpj": random_cnpj(200 + c),
                        "start_date": start,
                        "end_date": end,
                        "billing_model": random.choice([b[0] for b in Contract.BillingModel.choices]),
                        "base_value": Decimal(random.randint(30_000, 90_000)),
                        "included_km_per_month": random.choice([None, 2000, 4000, 6000]),
                        "extra_km_rate": Decimal(random.choice([1.35, 1.75, 2.15])),
                        "status": Contract.Status.ACTIVE,
                        "notes": "Contrato gerado automaticamente para mega carga.",
                    },
                )
                contracts.append(contract)

            for vehicle in vehicles:
                contract = random.choice(contracts)
                ContractVehicle.objects.get_or_create(
                    contract=contract,
                    municipality=muni,
                    vehicle=vehicle,
                    defaults={"start_date": contract.start_date, "custom_rate": Decimal("0")},
                )
                vehicle.current_contract = contract
                vehicle.save(update_fields=["current_contract"])

            # Períodos de locação (abertos, fechados e faturados)
            rental_periods = []
            for contract in contracts:
                for offset in range(0, 360, 60):
                    start_dt = aware_datetime_for_day(start_day + timedelta(days=offset), hour=9)
                    end_dt = start_dt + timedelta(days=random.randint(5, 20))
                    rp = RentalPeriod.objects.create(
                        municipality=muni,
                        contract=contract,
                        vehicle=random.choice(vehicles),
                        start_datetime=start_dt,
                        end_datetime=end_dt if random.random() > 0.2 else None,
                        odometer_start=random.randint(20_000, 120_000),
                        odometer_end=random.randint(120_000, 190_000) if random.random() > 0.2 else None,
                        billed_km=Decimal(random.randint(500, 5000)),
                        billed_amount=Decimal(random.randint(1500, 9000)),
                        status=random.choice(list(RentalPeriod.Status.values)),
                    )
                    rental_periods.append(rp)

            # Estoque e planos de manutenção
            parts = []
            for idx in range(6):
                part, _ = InventoryPart.objects.get_or_create(
                    municipality=muni,
                    sku=f"PEC-{m}-{idx}",
                    defaults={
                        "name": f"Peça {idx}",
                        "unit": "un",
                        "minimum_stock": Decimal("2"),
                        "current_stock": Decimal(random.randint(10, 40)),
                        "average_cost": Decimal(random.randint(50, 500)),
                        "is_active": True,
                    },
                )
                parts.append(part)
                InventoryMovement.objects.create(
                    municipality=muni,
                    part=part,
                    type=InventoryMovement.MovementType.IN,
                    quantity=Decimal(random.randint(5, 15)),
                    unit_cost=part.average_cost,
                    reference="Reposição inicial",
                    performed_by=user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                )
                InventoryMovement.objects.create(
                    municipality=muni,
                    part=part,
                    type=InventoryMovement.MovementType.OUT,
                    quantity=Decimal(random.randint(1, 5)),
                    unit_cost=part.average_cost,
                    reference="Consumo inicial",
                    performed_by=user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                )

            for vehicle in vehicles[:10]:
                MaintenancePlan.objects.get_or_create(
                    municipality=muni,
                    vehicle=vehicle,
                    name=f"Revisão KM {vehicle.license_plate}",
                    trigger_type=MaintenancePlan.TriggerType.KM,
                    defaults={
                        "interval_km": random.choice([5000, 10000]),
                        "last_service_odometer": vehicle.odometer_current - random.randint(1000, 4000),
                        "is_active": True,
                    },
                )
            MaintenancePlan.objects.get_or_create(
                municipality=muni,
                vehicle=None,
                name="Troca de óleo semestral - Frota",
                trigger_type=MaintenancePlan.TriggerType.TIME,
                defaults={"interval_days": 180, "last_service_date": start_day - timedelta(days=90)},
            )

            # Pneus e vínculos
            tires = []
            for idx in range(12):
                tire, _ = Tire.objects.get_or_create(
                    municipality=muni,
                    code=f"PNE-{m}-{idx}",
                    defaults={
                        "brand": random.choice(["Pirelli", "Bridgestone", "Goodyear"]),
                        "model": random.choice(["Aro16", "Aro15", "Aro14"]),
                        "size": random.choice(["195/55R16", "185/60R15", "205/65R16"]),
                        "purchase_date": start_day - timedelta(days=random.randint(30, 400)),
                        "purchase_price": Decimal(random.randint(400, 1200)),
                        "status": random.choice(list(Tire.Status.values)),
                        "total_km": random.randint(0, 15000),
                        "max_km_life": 50_000,
                    },
                )
                tires.append(tire)

            for vehicle in vehicles[:8]:
                for position in VehicleTire.Position.values:
                    if VehicleTire.objects.filter(vehicle=vehicle, position=position, active=True).exists():
                        continue
                    VehicleTire.objects.create(
                        tire=random.choice(tires),
                        vehicle=vehicle,
                        position=position,
                        installed_at=aware_datetime_for_day(start_day + timedelta(days=random.randint(0, 120))),
                        installed_odometer=vehicle.odometer_current - random.randint(500, 5000),
                        active=True,
                    )

            # Escolas e estudantes
            schools = []
            for idx in range(4):
                school, _ = School.objects.get_or_create(
                    municipality=muni,
                    name=f"Escola Mega {m}-{idx}",
                    defaults={
                        "inep_code": f"INEP{m}{idx:03d}",
                        "address": f"Rua da Escola {idx}",
                        "city": muni.city,
                        "district": f"Bairro {idx}",
                        "phone": random_phone(idx),
                        "type": random.choice([choice[0] for choice in School.SchoolType.choices]),
                        "is_active": True,
                    },
                )
                schools.append(school)

            students = []
            for idx in range(students_per_muni):
                school = random.choice(schools)
                student, _ = Student.objects.get_or_create(
                    municipality=muni,
                    cpf=f"7{m:02d}{idx:03d}{random.randint(1000,9999)}",
                    defaults={
                        "school": school,
                        "full_name": random_name("Aluno", idx),
                        "social_name": "" if random.random() > 0.2 else random_name("SN", idx),
                        "date_of_birth": date(2005, random.randint(1, 12), random.randint(1, 28)),
                        "registration_number": f"REG-{m}-{idx:04d}",
                        "grade": random.choice(["5A", "6B", "7C", "8A", "9B"]),
                        "shift": random.choice([choice[0] for choice in Student.Shift.choices]),
                        "address": f"Rua do Aluno {idx}",
                        "district": f"Bairro Estudante {idx%10}",
                        "has_special_needs": random.random() < 0.15,
                        "special_needs_details": "Acompanhamento" if random.random() < 0.15 else "",
                        "status": random.choice([choice[0] for choice in Student.Status.choices]),
                    },
                )
                students.append(student)

            student_cards = []
            for student in students[: min(len(students), 80)]:
                card, _ = StudentCard.objects.get_or_create(
                    municipality=muni,
                    student=student,
                    card_number=f"CARD-{student.id}-{random.randint(100,999)}",
                    defaults={
                        "issue_date": start_day + timedelta(days=random.randint(0, 120)),
                        "expiration_date": end_day,
                        "status": random.choice([choice[0] for choice in StudentCard.Status.choices]),
                        "qr_payload": f"QR-{student.cpf}",
                        "printed": random.random() < 0.7,
                    },
                )
                student_cards.append(card)

            for student in students[: min(len(students), 100)]:
                StudentTransportRegistration.objects.get_or_create(
                    municipality=muni,
                    student=student,
                    school=student.school,
                    pickup_address=student.address,
                    pickup_district=student.district,
                    dropoff_address=f"Av Principal {student.registration_number}",
                    dropoff_district=student.district,
                    shift=student.shift,
                    days_of_week=["MON", "TUE", "WED", "THU", "FRI"],
                    route_name=f"Rota Estudante {student.registration_number[-3:]}",
                    allowed_contract=random.choice(contracts),
                    status=random.choice([choice[0] for choice in StudentTransportRegistration.Status.choices]),
                    valid_from=start_day,
                    valid_until=end_day,
                )

            # Templates e envios de formulários cobrindo todos os tipos
            template, _ = FormTemplate.objects.get_or_create(
                municipality=muni,
                name=f"Formulário Mega {m}",
                defaults={
                    "slug": f"mega-2025-{m}",
                    "description": "Template abrangente para cobrir todos os tipos de questão.",
                    "is_active": True,
                    "require_cpf": True,
                    "form_type": random.choice([choice[0] for choice in FormTemplate.FormType.choices]),
                },
            )

            questions = []
            question_types = list(FormQuestion.QuestionType.values)
            for idx, qtype in enumerate(question_types):
                q = FormQuestion.objects.create(
                    form_template=template,
                    order=idx,
                    label=f"Pergunta {qtype}",
                    help_text="Gerada automaticamente",
                    field_name=f"campo_{idx}",
                    type=qtype,
                    required=idx % 2 == 0,
                    config={"scale_min": 1, "scale_max": 5} if qtype == FormQuestion.QuestionType.LINEAR_SCALE else {},
                )
                questions.append(q)
                if qtype in [
                    FormQuestion.QuestionType.MULTIPLE_CHOICE,
                    FormQuestion.QuestionType.CHECKBOXES,
                    FormQuestion.QuestionType.DROPDOWN,
                    FormQuestion.QuestionType.MULTIPLE_CHOICE_GRID,
                    FormQuestion.QuestionType.CHECKBOX_GRID,
                ]:
                    for opt_idx in range(4):
                        FormOption.objects.create(question=q, label=f"Opção {opt_idx}", value=f"op_{opt_idx}", order=opt_idx)

            submissions = []
            status_cycle = list(FormSubmission.Status.values)
            for idx in range(forms_per_muni):
                status = status_cycle[idx % len(status_cycle)]
                submission = FormSubmission.objects.create(
                    form_template=template,
                    municipality=muni,
                    cpf=f"123456{m:02d}{idx:04d}",
                    status=status,
                    status_notes="Processado automaticamente",
                )
                submissions.append(submission)
                for question in questions:
                    value_text = f"Resposta {question.field_name} #{idx}"
                    value_json = {"value": random.randint(1, 5)} if question.type.endswith("GRID") else None
                    if question.type == FormQuestion.QuestionType.LINEAR_SCALE:
                        value_text = str(random.randint(1, 5))
                    FormAnswer.objects.create(
                        submission=submission,
                        question=question,
                        value_text=value_text,
                        value_json=value_json,
                    )

            # Planejamento de transporte: pessoas, serviços, unidades, rotas e elegibilidade
            persons = []
            for idx in range(50):
                person = Person.objects.create(
                    municipality=muni,
                    full_name=random_name("Pessoa", idx),
                    cpf=f"9{m:02d}{idx:03d}{random.randint(1000,9999)}",
                    date_of_birth=date(1985, random.randint(1, 12), random.randint(1, 28)),
                    phone=random_phone(idx),
                    address=f"Endereço {idx}",
                    district=f"Bairro {idx%8}",
                    categories=["PRIORITY"] if random.random() < 0.2 else [],
                    status=random.choice([choice[0] for choice in Person.Status.choices]),
                )
                persons.append(person)

            services = []
            for idx, svc_type in enumerate(TransportService.ServiceType.values):
                svc, _ = TransportService.objects.get_or_create(
                    municipality=muni,
                    name=f"Serviço {svc_type} {m}-{idx}",
                    defaults={
                        "service_type": svc_type,
                        "description": "Serviço gerado para mega populate",
                        "requires_authorization": random.random() < 0.5,
                        "active": True,
                        "form_template": template,
                    },
                )
                services.append(svc)

            service_units = []
            for idx, unit_type in enumerate(ServiceUnit.UnitType.values):
                unit, _ = ServiceUnit.objects.get_or_create(
                    municipality=muni,
                    name=f"Unidade {unit_type} {m}-{idx}",
                    defaults={
                        "unit_type": unit_type,
                        "address": f"Endereço Unidade {idx}",
                        "lat": Decimal("-.23") + Decimal(idx),
                        "lng": Decimal("-46.6") + Decimal(idx) / 10,
                        "active": True,
                    },
                )
                service_units.append(unit)

            routes = []
            for idx, route_type in enumerate(Route.RouteType.values):
                route = Route.objects.create(
                    municipality=muni,
                    transport_service=random.choice(services),
                    code=f"RT-{m}-{idx}",
                    name=f"Rota {route_type} {m}-{idx}",
                    route_type=route_type,
                    days_of_week=["MON", "TUE", "WED", "THU", "FRI"],
                    time_window_start=time(7 + idx, 0),
                    time_window_end=time(9 + idx, 30),
                    estimated_duration_minutes=90 + idx * 10,
                    planned_capacity=random.randint(10, 30),
                    active=True,
                    contract=random.choice(contracts),
                    notes="Rota mega populate",
                )
                routes.append(route)
                route.preferred_vehicles.set(random.sample(vehicles, min(5, len(vehicles))))
                route.preferred_drivers.set(random.sample(drivers, min(5, len(drivers))))
                for stop_idx in range(4):
                    RouteStop.objects.create(
                        municipality=muni,
                        route=route,
                        order=stop_idx,
                        description=f"Ponto {stop_idx} - {route.name}",
                        scheduled_time=time(7 + stop_idx, stop_idx * 10),
                        stop_type=random.choice([choice[0] for choice in RouteStop.StopType.choices]),
                    )
                for unit in random.sample(service_units, min(len(service_units), 2)):
                    route.route_units.get_or_create(service_unit=unit, municipality=muni)

            for svc in services:
                EligibilityPolicy.objects.create(
                    municipality=muni,
                    transport_service=svc,
                    route=random.choice(routes),
                    name=f"Política {svc.name}",
                    rules_json={"min_age": 18, "priority": True},
                    decision_mode=random.choice([choice[0] for choice in EligibilityPolicy.DecisionMode.choices]),
                    active=True,
                )

            applications = []
            for person in persons[:20]:
                app = ServiceApplication.objects.create(
                    municipality=muni,
                    person=person,
                    transport_service=random.choice(services),
                    route=random.choice(routes),
                    form_submission=random.choice(submissions),
                    status=random.choice([choice[0] for choice in ServiceApplication.Status.choices]),
                    status_notes="Avaliado automaticamente",
                    correction_deadline=end_day - timedelta(days=random.randint(10, 90)),
                )
                applications.append(app)

            # OS e ordens de serviço cobrindo fluxos
            service_orders = []
            for idx, status in enumerate(ServiceOrder.Status.values):
                vehicle = random.choice(vehicles)
                so = ServiceOrder.objects.create(
                    municipality=muni,
                    vehicle=vehicle,
                    opened_by=user_roles.get(User.Roles.ADMIN_MUNICIPALITY),
                    assigned_to=user_roles.get(User.Roles.OPERATOR),
                    provider_name=f"Oficina {idx}",
                    type=random.choice([choice[0] for choice in ServiceOrder.Type.choices]),
                    priority=random.choice([choice[0] for choice in ServiceOrder.Priority.choices]),
                    status=status,
                    description=f"Ordem {status} para {vehicle.license_plate}",
                    opened_at=aware_datetime_for_day(start_day + timedelta(days=idx)),
                    started_at=aware_datetime_for_day(start_day + timedelta(days=idx), hour=10),
                    completed_at=aware_datetime_for_day(start_day + timedelta(days=idx + 1), hour=15)
                    if status == ServiceOrder.Status.COMPLETED
                    else None,
                    vehicle_odometer_open=vehicle.odometer_current,
                    vehicle_odometer_close=vehicle.odometer_current + random.randint(100, 800),
                    notes="Gerada automaticamente",
                )
                service_orders.append(so)
                part = random.choice(parts)
                ServiceOrderItem.objects.create(
                    service_order=so,
                    part=part,
                    quantity=Decimal(random.randint(1, 4)),
                    unit_cost=part.average_cost,
                )
                ServiceOrderLabor.objects.create(
                    service_order=so,
                    description="Mão de obra mecânica",
                    hours=Decimal("2.5"),
                    hourly_rate=Decimal("150.00"),
                )
                so.sync_vehicle_status()

            # Abastecimentos, manutenções e viagens diárias
            vehicle_odometer_map = {vehicle.id: vehicle.odometer_current for vehicle in vehicles}
            monthly_km = defaultdict(int)
            trips_created = []

            for day_offset in range(total_days):
                current_day = start_day + timedelta(days=day_offset)
                for _ in range(trips_per_day):
                    vehicle = random.choice(vehicles)
                    driver = random.choice(drivers)
                    origin = random.choice(["Centro", "Terminal", "UPA", "Escola", "Distrito Industrial"])
                    destination = random.choice(["Hospital", "Prefeitura", "Obra", "Zona Rural", "Terminal Norte"])
                    depart = aware_datetime_for_day(current_day)
                    expected_return = depart + timedelta(hours=random.randint(1, 6))
                    odometer_start = vehicle_odometer_map[vehicle.id]
                    status = random.choices(
                        [Trip.Status.PLANNED, Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED, Trip.Status.CANCELLED],
                        weights=[0.1, 0.2, 0.6, 0.1],
                    )[0]
                    odometer_end = None
                    actual_return = None
                    distance = 0
                    if status == Trip.Status.COMPLETED:
                        distance = random.randint(10, 220)
                        odometer_end = odometer_start + distance
                        vehicle_odometer_map[vehicle.id] = odometer_end
                        actual_return = expected_return + timedelta(minutes=random.randint(-20, 90))
                        monthly_km[(vehicle.id, depart.year, depart.month)] += distance
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
                        category=random.choice([Trip.Category.PASSENGER, Trip.Category.OBJECT, Trip.Category.MIXED]),
                        passengers_count=random.randint(0, 15),
                        passengers_details=[
                            {"name": random_name("Passageiro", p), "cpf": f"999.{p:03d}.{random.randint(100,999)}-0{p%9}"}
                            for p in range(random.randint(0, 5))
                        ],
                        cargo_description="Carga mista",
                        cargo_size=random.choice(["Pequeno", "Médio", "Grande"]),
                        cargo_quantity=random.randint(1, 30),
                        cargo_purpose="Entrega/retirada",
                        stops_description="Roteiro intenso gerado automaticamente.",
                        status=status,
                        notes="Dados massivos 2025.",
                    )
                    trips_created.append(trip)
                    if random.random() < 0.2 and status in [Trip.Status.IN_PROGRESS, Trip.Status.COMPLETED]:
                        TripIncident.objects.create(
                            municipality=muni,
                            trip=trip,
                            driver=driver,
                            description=random.choice(
                                [
                                    "Atraso por trânsito.",
                                    "Ponto não atendido.",
                                    "Condição de via ruim.",
                                    "Reagendamento solicitado.",
                                ]
                            ),
                        )

            # Abastecimentos mensais
            for vehicle in vehicles:
                for month in range(1, 13):
                    for _ in range(3):
                        fill_day = date(year, month, random.randint(1, 28))
                        station = random.choice(fuel_stations)
                        FuelLog.objects.create(
                            municipality=muni,
                            vehicle=vehicle,
                            driver=random.choice(drivers),
                            filled_at=fill_day,
                            liters=Decimal(random.randint(30, 80)),
                            fuel_station=station.name,
                            fuel_station_ref=station,
                            notes="Abastecimento massivo 2025.",
                        )

            for vehicle in vehicles:
                for _ in range(4):
                    VehicleMaintenance.objects.create(
                        vehicle=vehicle,
                        description=random.choice(["Troca de óleo", "Revisão geral", "Pastilha de freio", "Alinhamento"]),
                        date=start_day + timedelta(days=random.randint(0, total_days - 1)),
                        mileage=vehicle_odometer_map.get(vehicle.id, vehicle.odometer_current) - random.randint(100, 2000),
                    )

            # Viagens livres
            for vehicle in vehicles[:15]:
                open_trip = FreeTrip.objects.create(
                    municipality=muni,
                    driver=random.choice(drivers),
                    vehicle=vehicle,
                    status=FreeTrip.Status.OPEN,
                    odometer_start=vehicle_odometer_map.get(vehicle.id, vehicle.odometer_current),
                    started_at=aware_datetime_for_day(start_day + timedelta(days=random.randint(0, 300))),
                )
                FreeTrip.objects.create(
                    municipality=muni,
                    driver=random.choice(drivers),
                    vehicle=vehicle,
                    status=FreeTrip.Status.CLOSED,
                    odometer_start=open_trip.odometer_start,
                    odometer_end=open_trip.odometer_start + random.randint(50, 400),
                    started_at=open_trip.started_at,
                    ended_at=open_trip.started_at + timedelta(hours=random.randint(2, 12)),
                )

            # Odometria mensal consolidada
            odometer_objs = []
            for (vehicle_id, y, month), km in monthly_km.items():
                odometer_objs.append(MonthlyOdometer(vehicle_id=vehicle_id, year=y, month=month, kilometers=km))
            MonthlyOdometer.objects.bulk_create(odometer_objs, ignore_conflicts=True)

            # Ajustar odômetro final dos veículos com base nas viagens
            for vehicle in vehicles:
                final_odo = vehicle_odometer_map.get(vehicle.id, vehicle.odometer_current)
                if final_odo != vehicle.odometer_current:
                    vehicle.odometer_current = final_odo
                    vehicle.save(update_fields=["odometer_current"])

            # Escalas/rotas programadas
            for route in routes:
                for month in range(1, 13):
                    for day_choice in [5, 12, 19, 26]:
                        route_date = date(year, month, min(day_choice, 28))
                        assignment = Assignment.objects.create(
                            municipality=muni,
                            route=route,
                            date=route_date,
                            vehicle=random.choice(vehicles),
                            driver=random.choice(drivers),
                            status=random.choice([choice[0] for choice in Assignment.Status.choices]),
                            notes="Escala gerada automaticamente",
                        )
                        sample_trip = random.choice(trips_created)
                        assignment.generated_trip = sample_trip
                        assignment.save(update_fields=["generated_trip"])

            self.stdout.write(
                self.style.SUCCESS(
                    f"[{muni.name}] Dados massivos criados: veículos={len(vehicles)}, motoristas={len(drivers)}, "
                    f"viagens={len(trips_created)}, abastecimentos~{len(vehicles)*36}, formulários={len(submissions)}."
                )
            )

        self.stdout.write(self.style.SUCCESS("Super populate 2025 concluído! Senha padrão: pass123"))
