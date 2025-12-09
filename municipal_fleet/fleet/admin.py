from django.contrib import admin
from fleet.models import Vehicle, VehicleMaintenance, FuelLog, FuelStation


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("license_plate", "brand", "model", "municipality", "status")
    search_fields = ("license_plate", "brand", "model")
    list_filter = ("municipality", "status")


@admin.register(VehicleMaintenance)
class VehicleMaintenanceAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "date", "mileage")
    list_filter = ("date",)


@admin.register(FuelLog)
class FuelLogAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "driver", "filled_at", "liters", "fuel_station")
    list_filter = ("filled_at", "fuel_station")
    search_fields = ("vehicle__license_plate", "driver__name", "fuel_station")


@admin.register(FuelStation)
class FuelStationAdmin(admin.ModelAdmin):
    list_display = ("name", "municipality", "cnpj", "active")
    list_filter = ("municipality", "active")
    search_fields = ("name", "cnpj", "address")
