from django.contrib import admin
from drivers.models import Driver


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("name", "cpf", "municipality", "status")
    search_fields = ("name", "cpf")
    list_filter = ("municipality", "status")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        user = request.user
        if getattr(user, "role", None) == "SUPERADMIN":
            return qs
        return qs.filter(municipality=user.municipality)

    def get_exclude(self, request, obj=None):
        excluded = list(super().get_exclude(request, obj) or [])
        if getattr(request.user, "role", None) != "SUPERADMIN" and "municipality" not in excluded:
            excluded.append("municipality")
        return excluded

    def save_model(self, request, obj, form, change):
        if getattr(request.user, "role", None) != "SUPERADMIN":
            obj.municipality = request.user.municipality
        super().save_model(request, obj, form, change)
