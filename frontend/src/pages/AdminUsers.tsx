import { useEffect, useState } from "react";
import { api } from "../api/client";

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  clubUsername: string;
  role: "ADMIN" | "USER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedAt?: string | null;
}

const STATUS_LABEL: Record<ManagedUser["status"], string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.approveUser(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await api.rejectUser(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const pending = users.filter((u) => u.status === "PENDING");
  const others = users.filter((u) => u.status !== "PENDING");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2>Usuarios pendientes de aprobación</h2>
          <button className="btn-secondary" onClick={load}>
            Actualizar
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <p style={{ color: "var(--text-dim)" }}>Cargando...</p>
        ) : pending.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>No hay ninguna solicitud pendiente.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Usuario PrinciSport</th>
                <th>Registrado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.clubUsername}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString("es-ES")}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-primary"
                      disabled={busyId === u.id}
                      onClick={() => handleApprove(u.id)}
                    >
                      Aprobar
                    </button>
                    <button
                      className="btn-danger"
                      disabled={busyId === u.id}
                      onClick={() => handleReject(u.id)}
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Resto de usuarios</h2>
        {others.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>Todavía no hay nadie más.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {others.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === "ADMIN" ? "Administrador" : "Usuario"}</td>
                  <td>
                    <span className={`status-pill status-${u.status === "APPROVED" ? "CONFIRMED" : "FAILED"}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td>
                    {u.status === "REJECTED" && (
                      <button className="btn-secondary" disabled={busyId === u.id} onClick={() => handleApprove(u.id)}>
                        Aprobar de todas formas
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
