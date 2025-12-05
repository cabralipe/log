from django.contrib import admin
from fleet.models import Vehicle, VehicleMaintenance


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("license_plate", "brand", "model", "municipality", "status")
    search_fields = ("license_plate", "brand", "model")
    list_filter = ("municipality", "status")


@admin.register(VehicleMaintenance)
class VehicleMaintenanceAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "date", "mileage")
    list_filter = ("date",)
