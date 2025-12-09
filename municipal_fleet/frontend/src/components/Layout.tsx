import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSidebar } from "../stores/sidebar";
import { Menu, X, Home, Truck, Wrench, Users, MapPin, BarChart3, Building2, UserCircle } from "lucide-react";
import { useEffect } from "react";
import "./Layout.css";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { collapsed, toggle, setCollapsed } = useSidebar();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Auto-collapse on small screens
  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const handler = () => setCollapsed(media.matches);
    media.addEventListener("change", handler);
    handler();
    return () => media.removeEventListener("change", handler);
  }, [setCollapsed]);

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: Home },
    { to: "/vehicles", label: "Veículos", icon: Truck },
    { to: "/maintenance", label: "Manutenções", icon: Wrench },
    { to: "/drivers", label: "Motoristas", icon: Users },
    { to: "/trips", label: "Viagens", icon: MapPin },
    { to: "/reports", label: "Relatórios", icon: BarChart3 },
  ];
  const adminItems =
    user?.role === "SUPERADMIN"
      ? [
          { to: "/municipalities", label: "Prefeituras", icon: Building2 },
          { to: "/users", label: "Usuários", icon: UserCircle },
        ]
      : [];

  return (
    <div className="layout">
      <aside className={collapsed ? "collapsed" : ""}>
        <button
          className="toggle"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
        >
          {collapsed ? <Menu size={24} /> : <X size={24} />}
        </button>
        <div className="logo">Frotas</div>
        <nav id="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon size={24} />
              <span className="label" aria-hidden={collapsed}>{item.label}</span>
            </NavLink>
          ))}
          {adminItems.length > 0 && <div className="divider" />}
          {adminItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon size={24} />
              <span className="label" aria-hidden={collapsed}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="user">
          <span>{user?.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </aside>
      <main>
        <header>
          <Link to="/dashboard">
            <h1>Gestão de Frotas</h1>
          </Link>
          <div className="badge">{user?.role}</div>
        </header>
        {children}
      </main>
    </div>
  );
};
