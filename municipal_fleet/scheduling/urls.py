from django.urls import path
from rest_framework.routers import DefaultRouter
from scheduling.views import DriverAvailabilityBlockViewSet, AvailableDriversView, DriverCalendarView

router = DefaultRouter()
router.register(r"driver-availability-blocks", DriverAvailabilityBlockViewSet, basename="driver-availability-block")

urlpatterns = [
    path("drivers/available/", AvailableDriversView.as_view(), name="drivers-available"),
    path("drivers/<int:driver_id>/calendar/", DriverCalendarView.as_view(), name="driver-calendar"),
]
urlpatterns += router.urls
