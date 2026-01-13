from django.contrib import admin
from health.models import Patient, Companion


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "cpf", "municipality", "status", "needs_companion")
    search_fields = ("full_name", "cpf")
    list_filter = ("status", "needs_companion", "municipality")


@admin.register(Companion)
class CompanionAdmin(admin.ModelAdmin):
    list_display = ("full_name", "patient", "municipality", "active")
    search_fields = ("full_name", "cpf", "patient__full_name")
    list_filter = ("active", "municipality")
