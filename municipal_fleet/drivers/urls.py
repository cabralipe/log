from rest_framework.routers import DefaultRouter
from django.urls import path
from drivers.views import (
    DriverViewSet,
    DriverPortalLoginView,
    DriverPortalTripsView,
    DriverPortalAssignmentsView,
    DriverPortalFuelLogView,
    DriverPortalFuelStationsView,
    DriverPortalTripCompleteView,
    DriverPortalTripIncidentView,
    DriverPortalFreeTripListView,
    DriverPortalFreeTripStartView,
    DriverPortalFreeTripCloseView,
    DriverPortalFreeTripIncidentView,
    DriverPortalVehiclesView,
)

router = DefaultRouter()
router.register(r"", DriverViewSet, basename="driver")

urlpatterns = [
    path("portal/login/", DriverPortalLoginView.as_view(), name="driver-portal-login"),
    path("portal/trips/", DriverPortalTripsView.as_view(), name="driver-portal-trips"),
    path("portal/assignments/", DriverPortalAssignmentsView.as_view(), name="driver-portal-assignments"),
    path("portal/trips/<int:trip_id>/complete/", DriverPortalTripCompleteView.as_view(), name="driver-portal-trip-complete"),
    path("portal/trips/<int:trip_id>/incidents/", DriverPortalTripIncidentView.as_view(), name="driver-portal-trip-incident"),
    path("portal/fuel_logs/", DriverPortalFuelLogView.as_view(), name="driver-portal-fuel-logs"),
    path("portal/fuel_stations/", DriverPortalFuelStationsView.as_view(), name="driver-portal-fuel-stations"),
    path("portal/free_trips/", DriverPortalFreeTripListView.as_view(), name="driver-portal-free-trips"),
    path("portal/free_trips/start/", DriverPortalFreeTripStartView.as_view(), name="driver-portal-free-trip-start"),
    path("portal/free_trips/<int:free_trip_id>/close/", DriverPortalFreeTripCloseView.as_view(), name="driver-portal-free-trip-close"),
    path("portal/free_trips/<int:free_trip_id>/incidents/", DriverPortalFreeTripIncidentView.as_view(), name="driver-portal-free-trip-incident"),
    path("portal/vehicles/", DriverPortalVehiclesView.as_view(), name="driver-portal-vehicles"),
]
urlpatterns += router.urls
