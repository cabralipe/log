from rest_framework.routers import DefaultRouter
from tenants.views import MunicipalityViewSet

router = DefaultRouter()
router.register(r"", MunicipalityViewSet, basename="municipality")

urlpatterns = router.urls
