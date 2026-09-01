import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { tempToken } = await api.login({ email, password });
      sessionStorage.setItem("tempToken", tempToken);
      sessionStorage.setItem("pendingEmail", email);
      navigate("/verify-2fa");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="brand-mark" style={{ marginBottom: 18 }}>
          🎾 CLUB PÁDEL
        </div>
        <h1>Iniciar sesión</h1>
        <p>Te enviaremos un código de verificación por email.</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Enviando código..." : "Continuar"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 13, textAlign: "center" }}>
          ¿No tienes cuenta? <Link to="/register">Crea una</Link>
        </p>
      </div>
    </div>
  );
}
