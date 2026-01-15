from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Wrapper para o superpopulate. "
        "Use este comando para carga demo completa com volume medio."
    )

    def add_arguments(self, parser):
        parser.add_argument("--municipalities", type=int, default=3, help="Quantidade de prefeituras (default: 3)")
        parser.add_argument("--vehicles-per-muni", type=int, default=15, help="Veiculos por prefeitura (default: 15)")
        parser.add_argument("--drivers-per-muni", type=int, default=20, help="Motoristas por prefeitura (default: 20)")
        parser.add_argument("--trips-per-muni", type=int, default=200, help="Viagens por prefeitura (default: 200)")
        parser.add_argument("--scale", type=int, default=1, help="Multiplicador de volume (default: 1)")

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("== seed_full_demo: delegando para superpopulate =="))
        call_command(
            "superpopulate",
            municipalities=options["municipalities"],
            vehicles_per_muni=options["vehicles_per_muni"],
            drivers_per_muni=options["drivers_per_muni"],
            trips_per_muni=options["trips_per_muni"],
            scale=options["scale"],
        )
