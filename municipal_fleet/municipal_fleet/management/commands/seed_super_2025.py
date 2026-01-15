from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Wrapper para o superpopulate em volume alto. "
        "Calcula viagens por municipio a partir de trips-per-day * 365."
    )

    def add_arguments(self, parser):
        parser.add_argument("--municipalities", type=int, default=5, help="Quantidade de prefeituras (default: 5)")
        parser.add_argument("--vehicles-per-muni", type=int, default=30, help="Veiculos por prefeitura (default: 30)")
        parser.add_argument("--drivers-per-muni", type=int, default=60, help="Motoristas por prefeitura (default: 60)")
        parser.add_argument(
            "--trips-per-day",
            type=int,
            default=8,
            help="Viagens por dia (default: 8). Total anual = trips-per-day * 365.",
        )
        parser.add_argument("--students-per-muni", type=int, default=120, help="Alunos por prefeitura (default: 120)")
        parser.add_argument("--forms-per-muni", type=int, default=80, help="Submissoes por prefeitura (default: 80)")
        parser.add_argument("--routes-per-muni", type=int, default=10, help="Rotas por prefeitura (default: 10)")
        parser.add_argument("--patients-per-muni", type=int, default=60, help="Pacientes por prefeitura (default: 60)")
        parser.add_argument("--scale", type=int, default=2, help="Multiplicador extra de volume (default: 2)")

    def handle(self, *args, **options):
        trips_per_muni = max(int(options["trips_per_day"]), 1) * 365
        self.stdout.write(self.style.NOTICE("== seed_super_2025: delegando para superpopulate =="))
        call_command(
            "superpopulate",
            municipalities=options["municipalities"],
            vehicles_per_muni=options["vehicles_per_muni"],
            drivers_per_muni=options["drivers_per_muni"],
            trips_per_muni=trips_per_muni,
            students_per_muni=options["students_per_muni"],
            forms_per_muni=options["forms_per_muni"],
            routes_per_muni=options["routes_per_muni"],
            patients_per_muni=options["patients_per_muni"],
            scale=options["scale"],
        )
