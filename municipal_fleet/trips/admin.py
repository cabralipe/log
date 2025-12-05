from django.contrib import admin
from trips.models import Trip, MonthlyOdometer


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("origin", "destination", "departure_datetime", "status", "vehicle", "driver")
    search_fields = ("origin", "destination", "vehicle__license_plate", "driver__name")
    list_filter = ("status", "municipality")


@admin.register(MonthlyOdometer)
class MonthlyOdometerAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "month", "year", "kilometers")
    list_filter = ("year", "month")
