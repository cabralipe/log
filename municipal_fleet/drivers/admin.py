from django.contrib import admin
from drivers.models import Driver


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("name", "cpf", "municipality", "status")
    search_fields = ("name", "cpf")
    list_filter = ("municipality", "status")
