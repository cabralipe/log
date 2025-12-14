from django.contrib import admin
from transport_planning import models


@admin.register(models.Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("full_name", "cpf", "municipality", "status")
    search_fields = ("full_name", "cpf")
    list_filter = ("status",)


@admin.register(models.TransportService)
class TransportServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "service_type", "municipality", "requires_authorization", "active")
    list_filter = ("service_type", "active")
    search_fields = ("name",)


@admin.register(models.Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "transport_service", "municipality", "route_type", "active")
    search_fields = ("code", "name")
    list_filter = ("route_type", "active")


@admin.register(models.RouteStop)
class RouteStopAdmin(admin.ModelAdmin):
    list_display = ("route", "order", "description", "scheduled_time")
    list_filter = ("stop_type",)
    ordering = ("route", "order")


@admin.register(models.ServiceUnit)
class ServiceUnitAdmin(admin.ModelAdmin):
    list_display = ("name", "unit_type", "municipality", "active")
    search_fields = ("name",)
    list_filter = ("unit_type", "active")


@admin.register(models.RouteUnit)
class RouteUnitAdmin(admin.ModelAdmin):
    list_display = ("route", "service_unit", "municipality")


@admin.register(models.EligibilityPolicy)
class EligibilityPolicyAdmin(admin.ModelAdmin):
    list_display = ("name", "transport_service", "route", "decision_mode", "active")
    list_filter = ("decision_mode", "active")


@admin.register(models.ServiceApplication)
class ServiceApplicationAdmin(admin.ModelAdmin):
    list_display = ("transport_service", "person", "status", "created_at")
    list_filter = ("status", "transport_service")
    search_fields = ("person__cpf", "person__full_name")


@admin.register(models.Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("route", "date", "vehicle", "driver", "status")
    list_filter = ("status",)
    search_fields = ("route__code", "vehicle__license_plate", "driver__name")
