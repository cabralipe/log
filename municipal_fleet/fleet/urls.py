from rest_framework.routers import DefaultRouter
from fleet.views import (
    VehicleViewSet,
    VehicleMaintenanceViewSet,
    FuelLogViewSet,
    FuelStationViewSet,
    VehicleInspectionViewSet,
)

router = DefaultRouter()
router.register(r"maintenance", VehicleMaintenanceViewSet, basename="vehicle-maintenance")
router.register(r"fuel_logs", FuelLogViewSet, basename="fuel-log")
router.register(r"fuel_stations", FuelStationViewSet, basename="fuel-station")
router.register(r"inspections", VehicleInspectionViewSet, basename="vehicle-inspection")
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls
