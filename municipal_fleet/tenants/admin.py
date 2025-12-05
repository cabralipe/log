from django.contrib import admin
from tenants.models import Municipality


@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ("name", "cnpj", "city", "state")
    search_fields = ("name", "cnpj")
    list_filter = ("state",)
