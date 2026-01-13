from django.contrib import admin
from trips.models import (
    Trip,
    MonthlyOdometer,
    TripGpsPing,
    PlannedTrip,
    PlannedTripStop,
    PlannedTripPassenger,
    TripExecution,
    TripExecutionStop,
    TripManifest,
    TripManifestPassenger,
)


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("origin", "destination", "departure_datetime", "status", "vehicle", "driver")
    search_fields = ("origin", "destination", "vehicle__license_plate", "driver__name")
    list_filter = ("status", "municipality")


@admin.register(MonthlyOdometer)
class MonthlyOdometerAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "month", "year", "kilometers")
    list_filter = ("year", "month")


@admin.register(TripGpsPing)
class TripGpsPingAdmin(admin.ModelAdmin):
    list_display = ("trip", "driver", "recorded_at", "speed", "accuracy")
    list_filter = ("trip", "driver")
    search_fields = ("trip__origin", "trip__destination", "driver__name")


@admin.register(PlannedTrip)
class PlannedTripAdmin(admin.ModelAdmin):
    list_display = ("title", "module", "start_date", "recurrence", "vehicle", "driver", "active")
    list_filter = ("module", "recurrence", "active", "municipality")
    search_fields = ("title", "vehicle__license_plate", "driver__name")


@admin.register(PlannedTripStop)
class PlannedTripStopAdmin(admin.ModelAdmin):
    list_display = ("planned_trip", "destination", "order")
    list_filter = ("planned_trip",)


@admin.register(PlannedTripPassenger)
class PlannedTripPassengerAdmin(admin.ModelAdmin):
    list_display = ("planned_trip", "passenger_type", "student", "patient", "companion")
    list_filter = ("passenger_type",)


@admin.register(TripExecution)
class TripExecutionAdmin(admin.ModelAdmin):
    list_display = ("id", "module", "status", "scheduled_departure", "vehicle", "driver")
    list_filter = ("module", "status", "municipality")
    search_fields = ("vehicle__license_plate", "driver__name")


@admin.register(TripExecutionStop)
class TripExecutionStopAdmin(admin.ModelAdmin):
    list_display = ("trip_execution", "destination", "order")
    list_filter = ("trip_execution",)


@admin.register(TripManifest)
class TripManifestAdmin(admin.ModelAdmin):
    list_display = ("trip_execution", "total_passengers", "created_at")


@admin.register(TripManifestPassenger)
class TripManifestPassengerAdmin(admin.ModelAdmin):
    list_display = ("manifest", "passenger_type", "student", "patient", "companion")
    list_filter = ("passenger_type",)
