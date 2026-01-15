from rest_framework.routers import DefaultRouter
from fleet.views import (
    VehicleViewSet,
    VehicleMaintenanceViewSet,
    FuelLogViewSet,
    FuelStationViewSet,
    VehicleInspectionViewSet,
    FuelProductViewSet,
    FuelStationLimitViewSet,
    FuelRuleViewSet,
    FuelAlertViewSet,
    FuelInvoiceViewSet,
)

router = DefaultRouter()
router.register(r"maintenance", VehicleMaintenanceViewSet, basename="vehicle-maintenance")
router.register(r"fuel_logs", FuelLogViewSet, basename="fuel-log")
router.register(r"fuel_stations", FuelStationViewSet, basename="fuel-station")
router.register(r"inspections", VehicleInspectionViewSet, basename="vehicle-inspection")
router.register(r"fuel_products", FuelProductViewSet, basename="fuel-product")
router.register(r"fuel_rules", FuelRuleViewSet, basename="fuel-rule")
router.register(r"fuel_station_limits", FuelStationLimitViewSet, basename="fuel-station-limit")
router.register(r"fuel_invoices", FuelInvoiceViewSet, basename="fuel-invoice")
router.register(r"fuel_alerts", FuelAlertViewSet, basename="fuel-alert")
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls
