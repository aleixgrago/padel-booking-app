import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ScheduleReservation from "./ScheduleReservation";
import MyReservations from "./MyReservations";

type Tab = "schedule" | "history";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("schedule");
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">
          <span className="brand-mark">🎾 CLUB PÁDEL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "var(--text-dim)", fontSize: 14 }}>{user?.name}</span>
          <button className="btn-secondary" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "schedule" ? "active" : ""}`} onClick={() => setTab("schedule")}>
          Programar reserva
        </button>
        <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          Mis reservas
        </button>
      </div>

      <div className="content">{tab === "schedule" ? <ScheduleReservation /> : <MyReservations />}</div>
    </div>
  );
}
