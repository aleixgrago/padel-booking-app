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

/**
 * Grupos de pistas que comparten la misma franja horaria y son
 * intercambiables entre sí: si la pista pedida no está disponible, se
 * puede probar automáticamente con cualquier otra del mismo grupo.
 *
 * Pistas 1-4 comparten horario -> son un único grupo.
 * Pista 5 va sola (no hay ninguna otra pista con su mismo horario en
 * nuestro sistema), así que no tiene alternativas.
 */
const COURT_GROUPS: number[][] = [
  [1, 2, 3, 4],
  [5],
];

/**
 * Calcula el orden en el que se deben ir probando las pistas cuando la
 * solicitada no está disponible: empieza por la pedida, y si falla, sigue
 * con las demás del mismo grupo en orden cíclico a partir de ella.
 *
 * Ejemplo: pides la Pista 2 -> orden de intento: [2, 3, 4, 1]
 * (coincide con el ejemplo: si falla la 2, se prueba 3, luego 4, luego 1).
 */
export function getBookingAttemptOrder(preferredCourtId: number): number[] {
  const group = COURT_GROUPS.find((g) => g.includes(preferredCourtId));
  if (!group) return [preferredCourtId];

  const idx = group.indexOf(preferredCourtId);
  const rotated = [...group.slice(idx + 1), ...group.slice(0, idx)];
  return [preferredCourtId, ...rotated];
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
