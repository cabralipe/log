from django.urls import path
from reports.views import DashboardView, OdometerReportView, TripReportView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard-report"),
    path("odometer/", OdometerReportView.as_view(), name="odometer-report"),
    path("trips/", TripReportView.as_view(), name="trip-report"),
]
