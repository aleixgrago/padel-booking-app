import { env } from "../config/env";

export interface CourtDefinition {
  id: number;
  name: string;
  slotMinutes: number;
  slots: string[]; // hora de inicio de cada franja, formato "HH:mm"
}

// Pistas 1 a 4: mismo horario, franjas de 1h30
// 16:30-18:00 / 18:00-19:30 / 19:30-21:00
const STANDARD_SLOTS = ["16:30", "18:00", "19:30"];

// Pista 5: franjas de 1h15
// 16:30-17:45 / 17:45-19:00 / 19:00-20:15 / 20:15-21:30
const COURT_5_SLOTS = ["16:30", "17:45", "19:00", "20:15"];

export const COURTS: CourtDefinition[] = [
  { id: 1, name: "Pista 1", slotMinutes: 90, slots: STANDARD_SLOTS },
  { id: 2, name: "Pista 2", slotMinutes: 90, slots: STANDARD_SLOTS },
  { id: 3, name: "Pista 3", slotMinutes: 90, slots: STANDARD_SLOTS },
  { id: 4, name: "Pista 4", slotMinutes: 90, slots: STANDARD_SLOTS },
  { id: 5, name: "Pista 5", slotMinutes: 75, slots: COURT_5_SLOTS },
];

export function getCourt(courtId: number): CourtDefinition | undefined {
  return COURTS.find((c) => c.id === courtId);
}

export function isValidSlot(courtId: number, timeSlot: string): boolean {
  const court = getCourt(courtId);
  return !!court && court.slots.includes(timeSlot);
}

/**
 * Calcula el instante exacto en el que el cron debe intentar la reserva:
 * BOOKING_WINDOW_DAYS días antes de la fecha objetivo, a las 20:00h.
 *
 * Ej: si targetDate = 2026-09-02 y BOOKING_WINDOW_DAYS = 4,
 * executeAt = 2026-08-29 20:00:00 (hora local del servidor).
 */
export function computeExecuteAt(targetDate: Date): Date {
  const executeAt = new Date(targetDate);
  executeAt.setDate(executeAt.getDate() - env.scheduler.bookingWindowDays);
  executeAt.setHours(20, 0, 0, 0);
  return executeAt;
}
