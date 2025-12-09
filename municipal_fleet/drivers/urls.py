from rest_framework.routers import DefaultRouter
from django.urls import path
from drivers.views import (
    DriverViewSet,
    DriverPortalLoginView,
    DriverPortalTripsView,
    DriverPortalFuelLogView,
    DriverPortalFuelStationsView,
)

router = DefaultRouter()
router.register(r"", DriverViewSet, basename="driver")

urlpatterns = [
    path("portal/login/", DriverPortalLoginView.as_view(), name="driver-portal-login"),
    path("portal/trips/", DriverPortalTripsView.as_view(), name="driver-portal-trips"),
    path("portal/fuel_logs/", DriverPortalFuelLogView.as_view(), name="driver-portal-fuel-logs"),
    path("portal/fuel_stations/", DriverPortalFuelStationsView.as_view(), name="driver-portal-fuel-stations"),
]
urlpatterns += router.urls
