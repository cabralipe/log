from django.core.management.base import BaseCommand

from notifications.services import (
    dispatch_cnh_expiration_alerts,
    dispatch_maintenance_alerts,
    dispatch_trip_reminders,
)


class Command(BaseCommand):
    help = "Dispara notificações de CNH, manutenção e lembretes de viagens."

    def handle(self, *args, **options):
        dispatch_cnh_expiration_alerts()
        dispatch_maintenance_alerts()
        dispatch_trip_reminders()
        self.stdout.write(self.style.SUCCESS("Notificações processadas."))
