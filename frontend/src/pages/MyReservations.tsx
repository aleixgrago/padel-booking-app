import { useEffect, useState, Fragment } from "react";
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
  executionLog?: { at: string; message: string }[] | null;
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
              <Fragment key={r.id}>
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
                {r.executionLog && r.executionLog.length > 0 && (
                  <tr key={`${r.id}-log`}>
                    <td colSpan={6} style={{ paddingTop: 0 }}>
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-dim)" }}>
                          Ver detalle ({r.executionLog.length} pasos)
                        </summary>
                        <div
                          style={{
                            marginTop: 8,
                            padding: 12,
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            maxHeight: 220,
                            overflowY: "auto",
                            fontFamily: "monospace",
                            fontSize: 12,
                          }}
                        >
                          {r.executionLog.map((entry, i) => (
                            <div key={i} style={{ marginBottom: 4, color: "var(--text-dim)" }}>
                              <span style={{ color: "var(--court-green-bright)" }}>
                                {new Date(entry.at).toLocaleTimeString("es-ES", { hour12: false })}
                              </span>{" "}
                              {entry.message}
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
