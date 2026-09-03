import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ScheduleReservation from "./ScheduleReservation";
import MyReservations from "./MyReservations";
import AdminUsers from "./AdminUsers";

type Tab = "schedule" | "history" | "admin";

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
        {user?.role === "ADMIN" && (
          <button className={`tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>
            Administración
          </button>
        )}
      </div>

      <div className="content">
        {tab === "schedule" && <ScheduleReservation />}
        {tab === "history" && <MyReservations />}
        {tab === "admin" && user?.role === "ADMIN" && <AdminUsers />}
      </div>
    </div>
  );
}
