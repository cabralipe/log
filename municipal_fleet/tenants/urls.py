from django.urls import path
from rest_framework.routers import DefaultRouter
from tenants.views import MunicipalityViewSet, MunicipalitySettingsView

router = DefaultRouter()
router.register(r"", MunicipalityViewSet, basename="municipality")

urlpatterns = [
    path("settings/", MunicipalitySettingsView.as_view(), name="municipality-settings"),
]
urlpatterns += router.urls
