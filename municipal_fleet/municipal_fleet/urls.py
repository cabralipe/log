from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from municipal_fleet.health import health_view
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("", RedirectView.as_view(url="/api/docs/", permanent=False)),
    path("api/health/", health_view, name="health"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/auth/", include("accounts.urls")),
    path("api/municipalities/", include("tenants.urls")),
    path("api/vehicles/", include("fleet.urls")),
    path("api/drivers/", include("drivers.urls")),
    path("api/trips/", include("trips.urls")),
    path("api/reports/", include("reports.urls")),
]
