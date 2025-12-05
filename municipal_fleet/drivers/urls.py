from rest_framework.routers import DefaultRouter
from drivers.views import DriverViewSet

router = DefaultRouter()
router.register(r"", DriverViewSet, basename="driver")

urlpatterns = router.urls
