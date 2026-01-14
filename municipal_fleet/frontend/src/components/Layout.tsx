import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSidebar } from "../stores/sidebar";
import {
  Menu,
  X,
  Home,
  Truck,
  Wrench,
  Users,
  MapPin,
  Map,
  BarChart3,
  Building2,
  UserCircle,
  Fuel,
  FileText,
  Clock3,
  ClipboardList,
  Inbox,
  BadgeCheck,
  ShieldCheck,
  Route as RouteIcon,
  Shuffle,
  CalendarClock,
  Send,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  FileCheck,
  Droplets,
} from "lucide-react";
import { useEffect, useState } from "react";
import "./Layout.css";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed, toggle, setCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isAdmin = user?.role === "SUPERADMIN" || user?.role === "ADMIN_MUNICIPALITY";

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const canValidateCard = user && user.role !== "VIEWER";

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: Home },
    { to: "/vehicles", label: "Veículos", icon: Truck },
    { to: "/maintenance", label: "Manutenções", icon: Wrench },
    { to: "/drivers", label: "Motoristas", icon: Users },
    { to: "/contracts", label: "Contratos", icon: FileText },
    { to: "/rental-periods", label: "Locações", icon: Clock3 },
    ...(isAdmin ? [{ to: "/fuel-stations", label: "Postos", icon: Fuel }] : []),
    { to: "/service-orders", label: "Ordens de Serviço", icon: FileCheck },
    { to: "/fuel-management", label: "Gestão de Combustível", icon: Droplets },
    { to: "/trips", label: "Viagens", icon: MapPin },
    { to: "/destinations", label: "Destinos", icon: MapPin },
    { to: "/health/patients", label: "Saúde", icon: Users },
    { to: "/education", label: "Educação", icon: Building2 },
    { to: "/live-tracking", label: "Rastreamento", icon: Map },
    { to: "/free-trips", label: "Viagens livres", icon: Shuffle },
    { to: "/scheduling", label: "Agenda de motoristas", icon: CalendarClock },
    { to: "/transport-planning", label: "Planejamento logístico", icon: RouteIcon },
    { to: "/transport-planning/eligibility", label: "Elegibilidade", icon: ShieldCheck },
    { to: "/notifications", label: "Alertas", icon: Bell },
    ...(isAdmin
      ? [
        { to: "/form-templates", label: "Formulários", icon: ClipboardList },
        { to: "/form-submissions", label: "Submissões", icon: Inbox },
        { to: "/transport-requests", label: "Solicitação de transporte", icon: Send },
      ]
      : []),
    ...(canValidateCard ? [{ to: "/card-validator", label: "Validar carteirinha", icon: BadgeCheck }] : []),
    { to: "/reports", label: "Relatórios", icon: BarChart3 },
    { to: "/help", label: "Ajuda", icon: HelpCircle },
  ];
  const adminItems = [];
  if (user?.role === "SUPERADMIN") {
    adminItems.push({ to: "/municipalities", label: "Prefeituras", icon: Building2 });
  }
  if (isAdmin) {
    adminItems.push({ to: "/users", label: "Usuários", icon: UserCircle });
  }

  const ROLE_TRANSLATIONS: Record<string, string> = {
    SUPERADMIN: "Super Admin",
    ADMIN_MUNICIPALITY: "Admin Municipal",
    OPERATOR: "Operador",
    VIEWER: "Visualizador",
    DRIVER: "Motorista",
  };

  return (
    <div className="layout">
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Header */}
      <div className="mobile-header">
        <button
          className="menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={`${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>

        {/* Desktop Toggle */}
        <button
          className="toggle"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        <nav id="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              aria-label={item.label}
              title={collapsed ? item.label : ""}
            >
              <item.icon size={22} />
              <span className="label">{item.label}</span>
            </NavLink>
          ))}
          {adminItems.length > 0 && <div className="divider" />}
          {adminItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              aria-label={item.label}
              title={collapsed ? item.label : ""}
            >
              <item.icon size={22} />
              <span className="label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="user">
          <span>{user?.email}</span>
          <button onClick={handleLogout} title="Sair">
            <LogOut size={18} />
            <span className="label">Sair</span>
          </button>
        </div>
      </aside>
      <main>
        <header>
          <Link to="/dashboard">
            <h1>Gestão de Frotas</h1>
          </Link>
          <div className="badge">{user?.role ? (ROLE_TRANSLATIONS[user.role] || user.role) : ""}</div>
        </header>
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
