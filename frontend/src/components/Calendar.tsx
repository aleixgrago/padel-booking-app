import { useState } from "react";

interface CalendarProps {
  selectedDate: string | null; // "YYYY-MM-DD"
  onSelect: (date: string) => void;
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function Calendar({ selectedDate, onSelect }: CalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDay = new Date(year, month, 1);
  // Lunes = 0 ... Domingo = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" className="btn-secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          ←
        </button>
        <strong style={{ fontFamily: "var(--font-display)" }}>
          {MESES[month]} {year}
        </strong>
        <button type="button" className="btn-secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {DIAS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const iso = toISODate(date);
          const isPast = date < today;
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(iso)}
              className="slot-btn"
              style={{
                opacity: isPast ? 0.3 : 1,
                borderColor: isSelected ? "var(--court-green)" : undefined,
                background: isSelected ? "rgba(76,140,107,0.18)" : undefined,
                color: isSelected ? "var(--court-green-bright)" : undefined,
                padding: "8px 4px",
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
