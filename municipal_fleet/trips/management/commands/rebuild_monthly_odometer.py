from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db.models import F, ExpressionWrapper, IntegerField
from django.utils import timezone

from trips.models import Trip, MonthlyOdometer


class Command(BaseCommand):
    help = "Recalcula resumos de odômetro mensal a partir das viagens concluídas."

    def handle(self, *args, **options):
        qs = Trip.objects.filter(status=Trip.Status.COMPLETED, odometer_end__isnull=False)
        distance_expr = ExpressionWrapper(F("odometer_end") - F("odometer_start"), output_field=IntegerField())
        totals = defaultdict(int)

        for trip in qs.annotate(distance=distance_expr):
            if trip.distance is None or trip.distance < 0:
                continue
            dt = timezone.localtime(trip.departure_datetime)
            key = (trip.vehicle_id, dt.year, dt.month)
            totals[key] += trip.distance

        updated = 0
        for (vehicle_id, year, month), km in totals.items():
            MonthlyOdometer.objects.update_or_create(
                vehicle_id=vehicle_id, year=year, month=month, defaults={"kilometers": km}
            )
            updated += 1

        self.stdout.write(self.style.SUCCESS(f"Resumos processados: {updated}"))
