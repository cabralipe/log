import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/Login";
import { DriverPortalPage } from "./pages/DriverPortal";
import { DashboardPage } from "./pages/Dashboard";
import { VehiclesPage } from "./pages/Vehicles";
import { DriversPage } from "./pages/Drivers";
import { FuelStationsPage } from "./pages/FuelStations";
import { TripsPage } from "./pages/Trips";
import { ReportsPage } from "./pages/Reports";
import { MaintenancePage } from "./pages/Maintenance";
import { MunicipalitiesPage } from "./pages/Municipalities";
import { UsersPage } from "./pages/Users";
import { Layout } from "./components/Layout";

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
      <Route path="/fuel-stations" element={<FuelStationsPage />} />
      <Route path="/trips" element={<TripsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/municipalities" element={<MunicipalitiesPage />} />
      <Route path="/users" element={<UsersPage />} />
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
