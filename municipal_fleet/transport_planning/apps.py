from django.apps import AppConfig


class TransportPlanningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "transport_planning"

    def ready(self):
        # Late import to avoid circular dependencies.
        from transport_planning import signals  # noqa: F401
