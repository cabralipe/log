from rest_framework.routers import DefaultRouter
from health.views import PatientViewSet, CompanionViewSet

router = DefaultRouter()
router.register(r"patients", PatientViewSet, basename="patient")
router.register(r"companions", CompanionViewSet, basename="companion")

urlpatterns = router.urls
