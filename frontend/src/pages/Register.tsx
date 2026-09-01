import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    clubUsername: "",
    clubPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.register(form);
      navigate("/login");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card" style={{ maxWidth: 420 }}>
        <div className="brand-mark" style={{ marginBottom: 18 }}>
          🎾 CLUB PÁDEL
        </div>
        <h1>Crear cuenta</h1>
        <p>Necesitamos también tu acceso a PrinciSport para poder reservar en tu nombre.</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre</label>
            <input required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="tu@email.com"
            />
          </div>
          <div className="field">
            <label>Contraseña de esta app</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div className="court-line" style={{ margin: "18px 0" }} />

          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 14 }}>
            Acceso a <strong>PrinciSport</strong> (se guarda cifrado, solo se usa para reservar
            automáticamente por ti).
          </p>

          <div className="field">
            <label>Código de usuario PrinciSport</label>
            <input
              required
              value={form.clubUsername}
              onChange={(e) => update("clubUsername", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Contraseña PrinciSport</label>
            <input
              type="password"
              required
              value={form.clubPassword}
              onChange={(e) => update("clubPassword", e.target.value)}
            />
          </div>

          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 13, textAlign: "center" }}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
