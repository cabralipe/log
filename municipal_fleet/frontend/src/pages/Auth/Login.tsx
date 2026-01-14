import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/login.css";

export const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card card">
        <h1>Frotas</h1>
        <p>Entre para gerenciar veículos, viagens e motoristas.</p>
        <form onSubmit={handleSubmit} className="grid form-grid">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p style={{ marginTop: "0.75rem", color: "var(--muted)", fontSize: "0.95rem" }}>
          Motorista com código? <a href="/driver-portal">Acesse aqui</a>
        </p>
      </div>
    </div>
  );
};
