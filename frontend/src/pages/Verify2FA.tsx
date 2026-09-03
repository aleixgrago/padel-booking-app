import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Verify2FA() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const email = sessionStorage.getItem("pendingEmail");
  const tempToken = sessionStorage.getItem("tempToken");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tempToken) {
      navigate("/login");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.verify2fa({ tempToken, code });
      login(user);
      sessionStorage.removeItem("tempToken");
      sessionStorage.removeItem("pendingEmail");
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Verifica tu identidad</h1>
        <p>
          Hemos enviado un código de 6 dígitos a <strong>{email}</strong>
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Código de verificación</label>
            <input
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              style={{ letterSpacing: "6px", fontSize: "20px", textAlign: "center" }}
            />
          </div>
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
