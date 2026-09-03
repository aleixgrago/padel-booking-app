import { useEffect, useState } from "react";
import { api } from "../api/client";
import Calendar from "../components/Calendar";

interface Court {
  id: number;
  name: string;
  slotMinutes: number;
  slots: string[];
}

/** Misma fórmula que el backend: fecha objetivo menos N días, a las 20:00h. */
function computeExecuteAt(targetDateISO: string, bookingWindowDays: number): Date {
  const executeAt = new Date(`${targetDateISO}T00:00:00`);
  executeAt.setDate(executeAt.getDate() - bookingWindowDays);
  executeAt.setHours(20, 0, 0, 0);
  return executeAt;
}

export default function ScheduleReservation() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookingWindowDays, setBookingWindowDays] = useState(4);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [executionLog, setExecutionLog] = useState<{ at: string; message: string }[] | null>(null);

  useEffect(() => {
    api
      .getCourts()
      .then((data) => {
        setCourts(data.courts);
        setBookingWindowDays(data.bookingWindowDays);
      })
      .catch((err) => setError(err.message));
  }, []);

  const selectedCourt = courts.find((c) => c.id === courtId);

  const windowAlreadyOpen =
    date !== null && computeExecuteAt(date, bookingWindowDays).getTime() <= Date.now();

  async function handleSchedule() {
    setError(null);
    setSuccess(null);

    if (!courtId || !date || !timeSlot) {
      setError("Elige pista, fecha y franja horaria antes de programar la reserva.");
      return;
    }

    setLoading(true);
    try {
      const reservation = await api.createReservation({ courtId, targetDate: date, timeSlot });
      const executeAt = new Date(reservation.executeAt);
      setSuccess(
        `Reserva programada. Se intentará automáticamente el ${executeAt.toLocaleDateString("es-ES")} a las 20:00h.`
      );
      setCourtId(null);
      setDate(null);
      setTimeSlot(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBookNow() {
    setError(null);
    setSuccess(null);
    setExecutionLog(null);

    if (!courtId || !date || !timeSlot) {
      setError("Elige pista, fecha y franja horaria antes de reservar.");
      return;
    }

    setLoading(true);
    try {
      const reservation = await api.bookNow({ courtId, targetDate: date, timeSlot });
      setExecutionLog(reservation.executionLog ?? null);

      if (reservation.status === "CONFIRMED") {
        const pistaFinal = reservation.bookedCourtId ?? reservation.courtId;
        setSuccess(
          pistaFinal !== courtId
            ? `¡Reservada! La Pista ${courtId} no estaba libre, así que se ha reservado la Pista ${pistaFinal}.`
            : `¡Reservada! Pista ${pistaFinal} confirmada al momento.`
        );
        setCourtId(null);
        setDate(null);
        setTimeSlot(null);
      } else {
        setError(reservation.lastError ?? "No se ha podido reservar ninguna pista disponible ahora mismo.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>1. Elige pista</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
          Pistas 1-4 comparten horario. La Pista 5 tiene franjas de 1h 15min.
        </p>
        <div className="court-grid" style={{ marginBottom: 24 }}>
          {courts.map((c) => (
            <button
              key={c.id}
              className={`court-tile ${courtId === c.id ? "selected" : ""}`}
              onClick={() => {
                setCourtId(c.id);
                setTimeSlot(null);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <h2 style={{ marginBottom: 12 }}>2. Elige fecha del partido</h2>
        <Calendar selectedDate={date} onSelect={setDate} />
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>3. Elige franja horaria</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
          {selectedCourt
            ? `${selectedCourt.name} · franjas de ${selectedCourt.slotMinutes} min`
            : "Primero elige una pista"}
        </p>

        <div className="slot-grid" style={{ marginBottom: 24 }}>
          {selectedCourt?.slots.map((slot) => (
            <button
              key={slot}
              className={`slot-btn ${timeSlot === slot ? "selected" : ""}`}
              onClick={() => setTimeSlot(slot)}
            >
              {slot}
            </button>
          ))}
        </div>

        <div className="court-line" style={{ marginBottom: 20 }} />

        {windowAlreadyOpen ? (
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Para esta fecha, la ventana de reserva del club <strong>ya está abierta</strong>: puedes
            reservar ahora mismo, sin esperar al cron de las 20:00h.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            La reserva no se hace ahora: quedará <strong>programada</strong> y el sistema intentará
            confirmarla automáticamente a las <strong>20:00h</strong>, {bookingWindowDays} días antes
            de la fecha del partido (cuando el club abre su ventana de reserva).
          </p>
        )}

        {error && <div className="error-banner">{error}</div>}
        {success && (
          <div
            className="error-banner"
            style={{ borderColor: "var(--court-green)", background: "rgba(76,140,107,0.12)", color: "var(--court-green-bright)" }}
          >
            {success}
          </div>
        )}

        {executionLog && executionLog.length > 0 && (
          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-dim)" }}>
              Ver detalle de lo que se ha hecho ({executionLog.length} pasos)
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
              {executionLog.map((entry, i) => (
                <div key={i} style={{ marginBottom: 4, color: "var(--text-dim)" }}>
                  <span style={{ color: "var(--court-green-bright)" }}>
                    {new Date(entry.at).toLocaleTimeString("es-ES", { hour12: false })}
                  </span>{" "}
                  {entry.message}
                </div>
              ))}
            </div>
          </details>
        )}

        {windowAlreadyOpen ? (
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading} onClick={handleBookNow}>
            {loading ? "Reservando..." : "Reservar ahora"}
          </button>
        ) : (
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading} onClick={handleSchedule}>
            {loading ? "Programando..." : "Programar reserva"}
          </button>
        )}
      </div>
    </div>
  );
}
