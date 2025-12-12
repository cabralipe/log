from rest_framework.routers import DefaultRouter
from trips.views import TripViewSet, FreeTripViewSet

router = DefaultRouter()
router.register(r"free-trips", FreeTripViewSet, basename="free-trip")
router.register(r"", TripViewSet, basename="trip")

urlpatterns = router.urls
