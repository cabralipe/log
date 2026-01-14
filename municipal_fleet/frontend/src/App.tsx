import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/Auth/Login";
import { DriverPortalPage } from "./pages/Portals/DriverPortal";
import { DashboardPage } from "./pages/Admin/Dashboard";
import { VehiclesPage } from "./pages/Fleet/Vehicles";
import { DriversPage } from "./pages/Fleet/Drivers";
import { FuelStationsPage } from "./pages/Fleet/FuelStations";
import { TripsPage } from "./pages/Operations/Trips";
import { ServiceOrdersPage } from "./pages/Fleet/ServiceOrders";
import { FuelManagementPage } from "./pages/Fleet/FuelManagement";
import { DestinationsPage } from "./pages/Planning/Destinations";
import { PatientsPage } from "./pages/Health/Patients";
import { EducationPage } from "./pages/Education/Education";
import { TripManifestPage } from "./pages/Operations/TripManifest";
import { ReportsPage } from "./pages/Admin/Reports";
import { MaintenancePage } from "./pages/Fleet/Maintenance";
import { MunicipalitiesPage } from "./pages/Admin/Municipalities";
import { UsersPage } from "./pages/Auth/Users";
import { ContractsPage } from "./pages/Admin/Contracts";
import { FreeTripsPage } from "./pages/Operations/FreeTrips";
import { RentalPeriodsPage } from "./pages/Admin/RentalPeriods";
import { PublicFormPage } from "./pages/Forms/PublicForm";
import { FormSubmissionsPage } from "./pages/Forms/FormSubmissions";
import { StudentCardsPage } from "./pages/Education/StudentCards";
import { FormTemplatesPage } from "./pages/Forms/FormTemplates";
import { LiveTrackingPage } from "./pages/Operations/LiveTracking";
import { SchoolMonitorPage } from "./pages/Operations/SchoolMonitor";
import { Layout } from "./components/Layout";
import { CardValidatorPage } from "./pages/Education/CardValidator";
import { TransportPlanningPage } from "./pages/Planning/TransportPlanning";
import { SchedulingPage } from "./pages/Operations/Scheduling";
import { TransportRequestsPage } from "./pages/Planning/TransportRequests";
import { NotificationsPage } from "./pages/Admin/Notifications";
import { HelpPage } from "./pages/Admin/Help";

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: "2rem" }}>Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/driver-portal" element={<DriverPortalPage />} />
    <Route path="/forms/:slug" element={<PublicFormPage />} />
    <Route path="/public/forms/:slug" element={<PublicFormPage />} />
    <Route
      element={
        <PrivateRoute>
          <Layout>
            <Outlet />
          </Layout>
        </PrivateRoute>
      }
    >
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/drivers" element={<DriversPage />} />
      <Route path="/contracts" element={<ContractsPage />} />
      <Route path="/rental-periods" element={<RentalPeriodsPage />} />
      <Route path="/service-orders" element={<ServiceOrdersPage />} />
      <Route path="/fuel-management" element={<FuelManagementPage />} />
      <Route path="/fuel-stations" element={<FuelStationsPage />} />
      <Route path="/destinations" element={<DestinationsPage />} />
      <Route path="/health/patients" element={<PatientsPage />} />
      <Route path="/education" element={<EducationPage />} />
      <Route path="/education/classes" element={<Navigate to="/education" replace />} />
      <Route path="/education/students" element={<Navigate to="/education" replace />} />
      <Route path="/trips" element={<TripsPage />} />
      <Route path="/trips/manifest/:id" element={<TripManifestPage />} />
      <Route path="/school-monitor" element={<SchoolMonitorPage />} />
      <Route path="/live-tracking" element={<LiveTrackingPage />} />
      <Route path="/free-trips" element={<FreeTripsPage />} />
      <Route path="/scheduling" element={<SchedulingPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/transport-planning" element={<TransportPlanningPage />} />
      <Route path="/transport-planning/eligibility" element={<TransportPlanningPage initialTab="eligibility" />} />
      <Route path="/transport-requests" element={<TransportRequestsPage />} />
      <Route path="/municipalities" element={<MunicipalitiesPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/form-templates" element={<FormTemplatesPage />} />
      <Route path="/form-submissions" element={<FormSubmissionsPage />} />
      <Route path="/student-cards" element={<StudentCardsPage />} />
      <Route path="/card-validator" element={<CardValidatorPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
);

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
