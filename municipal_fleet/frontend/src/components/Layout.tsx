import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./Layout.css";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/vehicles", label: "Veículos" },
  { to: "/drivers", label: "Motoristas" },
  { to: "/trips", label: "Viagens" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="layout">
      <aside>
        <div className="logo">Frotas</div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
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
