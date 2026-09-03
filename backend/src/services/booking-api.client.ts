import { env } from "../config/env";
import type { Reservation, User } from "@prisma/client";
import { decryptSecret } from "./encryption.service";
import { getPrinciSportCourt } from "./princiesport-courts.map";
import { reserveCourt } from "./princiesport.client";
import { takeSession } from "./session-cache";
import { getBookingAttemptOrder } from "./courts.config";

export interface LogEntry {
  at: string; // ISO timestamp
  message: string;
}

export interface BookingApiResult {
  success: boolean;
  clubBookingId?: string;
  bookedCourtId?: number;
  error?: string;
  /** Historial completo, con hora exacta de cada paso (login, cada intento...). */
  log: LogEntry[];
  /** Resumen por pista, útil para la tabla de "Mis reservas". */
  attemptsLog: { courtId: number; success: boolean; error?: string }[];
}

const MAX_RETRIES_PER_COURT = 4;
const RETRY_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Punto de entrada usado por el scheduler nocturno y por la reserva
 * inmediata ("Reservar ahora").
 *
 * Para la pista pedida, reintenta hasta 4 veces (por si la franja está
 * ocupada un instante y se libera enseguida, o hay un fallo puntual de
 * red). Si tras 4 intentos sigue sin poder, prueba con las demás pistas
 * del mismo grupo horario (1-4 entre ellas), también con sus 4 intentos
 * cada una, hasta conseguir una reserva o agotar todas las opciones.
 *
 * Mientras CLUB_BOOKING_API_KEY valga "pendiente" en el .env, se simula la
 * llamada (útil para probar el resto del sistema sin tocar la web real).
 */
export async function bookCourt(
  reservation: Reservation & { user: User }
): Promise<BookingApiResult> {
  const clubPassword = decryptSecret(reservation.user.clubPasswordEncrypted);
  const dateYYYYMMDD = reservation.targetDate.toISOString().slice(0, 10).replace(/-/g, "");
  const attemptOrder = getBookingAttemptOrder(reservation.courtId);

  const log: LogEntry[] = [];
  function record(message: string) {
    log.push({ at: new Date().toISOString(), message });
  }

  if (!env.club.baseUrl || env.club.apiKey === "pendiente") {
    record(
      `SIMULADO: usuario club ${reservation.user.clubUsername}, Pista ${reservation.courtId}, ` +
        `${reservation.timeSlot}, ${dateYYYYMMDD}. Orden de intento: ${attemptOrder.join(", ")}`
    );
    console.warn(`[booking-api] Llamada SIMULADA (activa CLUB_BOOKING_API_KEY para reservar de verdad)`);
    return {
      success: true,
      clubBookingId: `SIMULADO-${reservation.id}`,
      bookedCourtId: reservation.courtId,
      attemptsLog: [{ courtId: reservation.courtId, success: true }],
      log,
    };
  }

  const attemptsLog: BookingApiResult["attemptsLog"] = [];

  for (const candidateCourtId of attemptOrder) {
    const { sportCode, courtOptionValue } = getPrinciSportCourt(candidateCourtId);
    let lastError: string | undefined;
    let succeeded = false;
    let clubBookingId: string | undefined;

    for (let attemptNumber = 1; attemptNumber <= MAX_RETRIES_PER_COURT; attemptNumber++) {
      record(`Pista ${candidateCourtId}: intento ${attemptNumber}/${MAX_RETRIES_PER_COURT}...`);

      // Solo aprovechamos la sesión pre-calentada en el primer intento de
      // la pista que el usuario realmente pidió; en el resto, login normal.
      const existingSession =
        candidateCourtId === reservation.courtId && attemptNumber === 1
          ? takeSession(reservation.userId)
          : undefined;

      const result = await reserveCourt({
        clubUsername: reservation.user.clubUsername,
        clubPassword,
        sportCode,
        courtOptionValue,
        dateYYYYMMDD,
        timeSlotHHmm: reservation.timeSlot,
        existingSession,
        log: record,
      });

      if (result.success) {
        succeeded = true;
        clubBookingId = result.clubBookingId;
        break;
      }

      lastError = result.error;
      record(`Pista ${candidateCourtId}: intento ${attemptNumber} fallido (${result.error}).`);

      if (attemptNumber < MAX_RETRIES_PER_COURT) {
        await sleep(RETRY_DELAY_MS);
      }
    }

    attemptsLog.push({ courtId: candidateCourtId, success: succeeded, error: succeeded ? undefined : lastError });

    if (succeeded) {
      record(`¡Pista ${candidateCourtId} reservada con éxito!`);
      return { success: true, clubBookingId, bookedCourtId: candidateCourtId, attemptsLog, log };
    }

    record(`Pista ${candidateCourtId} agotada tras ${MAX_RETRIES_PER_COURT} intentos. Probando siguiente...`);
    await sleep(RETRY_DELAY_MS);
  }

  record(`No se ha podido reservar ninguna pista disponible (se probaron: ${attemptOrder.join(", ")}).`);

  return {
    success: false,
    error: `No se ha podido reservar ninguna pista disponible (se probaron: ${attemptOrder.join(", ")}).`,
    attemptsLog,
    log,
  };
}
