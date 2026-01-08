from rest_framework.routers import DefaultRouter

from notifications.views import NotificationViewSet, NotificationDeviceViewSet

router = DefaultRouter()
router.register(r"devices", NotificationDeviceViewSet, basename="notification-device")
router.register(r"", NotificationViewSet, basename="notification")

urlpatterns = router.urls
