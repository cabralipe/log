from rest_framework.routers import DefaultRouter
from django.urls import path
from trips.views import (
    TripViewSet,
    FreeTripViewSet,
    TripMapStateView,
    PlannedTripViewSet,
    TripExecutionViewSet,
    TripManifestViewSet,
)

router = DefaultRouter()
router.register(r"free-trips", FreeTripViewSet, basename="free-trip")
router.register(r"planned", PlannedTripViewSet, basename="planned-trip")
router.register(r"executions", TripExecutionViewSet, basename="trip-execution")
router.register(r"manifests", TripManifestViewSet, basename="trip-manifest")
router.register(r"", TripViewSet, basename="trip")

urlpatterns = [
    path("map-state/", TripMapStateView.as_view(), name="trip-map-state"),
]
urlpatterns += router.urls
