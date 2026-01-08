from datetime import timedelta
from django.utils import timezone


STATUS_IN_ROUTE = "IN_ROUTE"
STATUS_STOPPED = "STOPPED"
STATUS_OFFLINE = "OFFLINE"

STATUS_LABELS = {
    STATUS_IN_ROUTE: "Em rota",
    STATUS_STOPPED: "Parado",
    STATUS_OFFLINE: "Offline",
}


def resolve_status(ping, now=None, offline_after=None, stopped_speed=1.0):
    if not ping:
        return STATUS_OFFLINE
    now = now or timezone.now()
    offline_after = offline_after or timedelta(minutes=2)
    if now - ping.recorded_at > offline_after:
        return STATUS_OFFLINE
    if ping.speed is not None and ping.speed <= stopped_speed:
        return STATUS_STOPPED
    return STATUS_IN_ROUTE
