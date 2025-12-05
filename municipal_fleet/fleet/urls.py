from rest_framework.routers import DefaultRouter
from fleet.views import VehicleViewSet, VehicleMaintenanceViewSet

router = DefaultRouter()
router.register(r"maintenance", VehicleMaintenanceViewSet, basename="vehicle-maintenance")
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls
