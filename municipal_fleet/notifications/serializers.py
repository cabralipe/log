from rest_framework import serializers

from notifications.models import Notification, NotificationDevice


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["id", "created_at", "sent_at", "delivery_error", "municipality"]


class NotificationDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationDevice
        fields = "__all__"
        read_only_fields = ["id", "created_at", "municipality", "user", "driver"]
