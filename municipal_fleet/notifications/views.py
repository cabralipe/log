from rest_framework import permissions, viewsets

from accounts.permissions import IsMunicipalityAdminOrReadOnly
from notifications.models import Notification, NotificationDevice
from notifications.serializers import NotificationSerializer, NotificationDeviceSerializer
from tenants.mixins import MunicipalityQuerysetMixin


class NotificationViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsMunicipalityAdminOrReadOnly]
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "role", None) == "SUPERADMIN":
            return qs
        return qs.filter(recipient_user=user)


class NotificationDeviceViewSet(MunicipalityQuerysetMixin, viewsets.ModelViewSet):
    queryset = NotificationDevice.objects.all()
    serializer_class = NotificationDeviceSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "role", None) == "SUPERADMIN":
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        municipality = user.municipality
        serializer.save(user=user, municipality=municipality)

