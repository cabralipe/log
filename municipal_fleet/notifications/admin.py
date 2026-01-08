from django.contrib import admin

from notifications.models import Notification, NotificationDevice


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("event_type", "channel", "recipient_user", "recipient_driver", "created_at", "is_read")
    list_filter = ("channel", "event_type", "is_read")
    search_fields = ("title", "message")


@admin.register(NotificationDevice)
class NotificationDeviceAdmin(admin.ModelAdmin):
    list_display = ("device_type", "token", "user", "driver", "active", "created_at")
    list_filter = ("device_type", "active")
    search_fields = ("token",)
