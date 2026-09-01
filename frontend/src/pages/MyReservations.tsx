import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Reservation {
  id: string;
  courtId: number;
  bookedCourtId?: number | null;
  targetDate: string;
  timeSlot: string;
  status: "SCHEDULED" | "PROCESSING" | "CONFIRMED" | "FAILED" | "CANCELLED";
  executeAt: string;
  lastError?: string | null;
}

const STATUS_LABEL: Record<Reservation["status"], string> = {
  SCHEDULED: "Programada",
  PROCESSING: "Ejecutando",
  CONFIRMED: "Confirmada",
  FAILED: "Fallida",
  CANCELLED: "Cancelada",
};

export default function MyReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listReservations();
      setReservations(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(id: string) {
    try {
      await api.cancelReservation(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Mis reservas</h2>
        <button className="btn-secondary" onClick={load}>
          Actualizar
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Cargando...</p>
      ) : reservations.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>Todavía no has programado ninguna reserva.</p>
      ) : (
        <table className="reservations-table">
          <thead>
            <tr>
              <th>Pista</th>
              <th>Fecha partido</th>
              <th>Hora</th>
              <th>Se ejecuta</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id}>
                <td>
                  Pista {r.courtId}
                  {r.bookedCourtId && r.bookedCourtId !== r.courtId && (
                    <div style={{ fontSize: 12, color: "var(--clay)", marginTop: 2 }}>
                      → reservada Pista {r.bookedCourtId}
                    </div>
                  )}
                </td>
                <td>{new Date(r.targetDate).toLocaleDateString("es-ES")}</td>
                <td>{r.timeSlot}</td>
                <td>
                  {new Date(r.executeAt).toLocaleDateString("es-ES")}{" "}
                  {new Date(r.executeAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>
                  <span className={`status-pill status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  {r.status === "FAILED" && r.lastError && (
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{r.lastError}</div>
                  )}
                </td>
                <td>
                  {r.status === "SCHEDULED" && (
                    <button className="btn-danger" onClick={() => handleCancel(r.id)}>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
