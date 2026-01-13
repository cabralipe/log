from django.contrib import admin
from destinations.models import Destination


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "municipality", "city", "state", "active")
    list_filter = ("type", "active", "municipality")
    search_fields = ("name", "address", "district", "city", "state")
