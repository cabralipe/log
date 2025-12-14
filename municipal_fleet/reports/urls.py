from django.urls import path
from reports.views import (
    DashboardView,
    OdometerReportView,
    TripReportView,
    FuelReportView,
    TripIncidentReportView,
    ContractsReportView,
    ContractUsageReportView,
    ExpiringContractsReportView,
    MaintenanceSummaryReportView,
    MaintenancePreventiveReportView,
    InventoryReportView,
    TireReportView,
    TransportPlanningReportView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard-report"),
    path("odometer/", OdometerReportView.as_view(), name="odometer-report"),
    path("trips/", TripReportView.as_view(), name="trip-report"),
    path("trip-incidents/", TripIncidentReportView.as_view(), name="trip-incident-report"),
    path("fuel/", FuelReportView.as_view(), name="fuel-report"),
    path("contracts/", ContractsReportView.as_view(), name="contracts-report"),
    path("contracts/usage/", ContractUsageReportView.as_view(), name="contracts-usage-report"),
    path("contracts/expiring/", ExpiringContractsReportView.as_view(), name="expiring-contracts-report"),
    path("maintenance/summary/", MaintenanceSummaryReportView.as_view(), name="maintenance-summary"),
    path("maintenance/preventive/", MaintenancePreventiveReportView.as_view(), name="maintenance-preventive"),
    path("inventory/", InventoryReportView.as_view(), name="inventory-report"),
    path("tires/", TireReportView.as_view(), name="tires-report"),
    path("transport-planning/", TransportPlanningReportView.as_view(), name="transport-planning-report"),
]
