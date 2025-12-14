from rest_framework import routers
from transport_planning import views


router = routers.DefaultRouter()
router.register(r"persons", views.PersonViewSet, basename="persons")
router.register(r"transport-services", views.TransportServiceViewSet, basename="transport-services")
router.register(r"routes", views.RouteViewSet, basename="routes")
router.register(r"route-stops", views.RouteStopViewSet, basename="route-stops")
router.register(r"service-units", views.ServiceUnitViewSet, basename="service-units")
router.register(r"eligibility-policies", views.EligibilityPolicyViewSet, basename="eligibility-policies")
router.register(r"service-applications", views.ServiceApplicationViewSet, basename="service-applications")
router.register(r"assignments", views.AssignmentViewSet, basename="assignments")

urlpatterns = router.urls
