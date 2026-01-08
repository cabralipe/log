from django.contrib import admin
from trips.models import Trip, MonthlyOdometer, TripGpsPing


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
