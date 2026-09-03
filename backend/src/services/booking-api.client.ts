import { env } from "../config/env";
import type { Reservation, User } from "@prisma/client";
import { decryptSecret } from "./encryption.service";
import { getPrinciSportCourt } from "./princiesport-courts.map";
import { reserveCourt, loginToPrinciSport } from "./princiesport.client";
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
  /** Historial completo, con hora exacta de cada paso (login, cada pista...). */
  log: LogEntry[];
  /** Resumen por pista, útil para la tabla de "Mis reservas". */
  attemptsLog: { courtId: number; success: boolean; error?: string }[];
}

/**
 * Punto de entrada usado por el scheduler nocturno y por la reserva
 * inmediata ("Reservar ahora").
 *
 * TODAS las pistas candidatas (la pedida + sus alternativas del mismo
 * grupo horario) se intentan EN PARALELO, sin ninguna pausa artificial
 * entre ellas: en una reserva por franjas horarias, la gente compite por
 * ser la más rápida, así que cada milisegundo cuenta. La primera que
 * consigue completar la reserva de verdad "gana la carrera"; el resto se
 * cancelan justo antes de confirmar (para no acabar reservando dos pistas
 * a la vez si dos candidatas llegan libres al mismo tiempo).
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
        `${reservation.timeSlot}, ${dateYYYYMMDD}. Pistas candidatas en paralelo: ${attemptOrder.join(", ")}`
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

  record(`Lanzando ${attemptOrder.length} intento(s) en paralelo: pistas ${attemptOrder.join(", ")}.`);

  // Un solo login sirve para TODAS las pistas candidatas (es la misma
  // cuenta de socio): evita hacer login por separado en cada rama paralela.
  let sharedSession = takeSession(reservation.userId);
  if (sharedSession) {
    record("Reutilizando sesión pre-iniciada (sin necesidad de login).");
  } else {
    try {
      sharedSession = await loginToPrinciSport(reservation.user.clubUsername, clubPassword, record);
    } catch (err) {
      record(`Error haciendo login: ${(err as Error).message}`);
      return {
        success: false,
        error: `No se ha podido iniciar sesión en PrinciSport: ${(err as Error).message}`,
        attemptsLog: [],
        log,
      };
    }
  }

  // "won" se marca de forma síncrona (sin await entre comprobar y marcar),
  // así que no hay condición de carrera real aunque varias pistas terminen
  // de seleccionar su franja casi al mismo tiempo: solo la primera que pasa
  // por este punto llega a confirmar; las demás se cancelan justo antes.
  let won = false;

  async function tryCourt(courtId: number) {
    const { sportCode, courtOptionValue } = getPrinciSportCourt(courtId);

    const result = await reserveCourt({
      clubUsername: reservation.user.clubUsername,
      clubPassword,
      sportCode,
      courtOptionValue,
      dateYYYYMMDD,
      timeSlotHHmm: reservation.timeSlot,
      existingSession: sharedSession,
      log: (msg) => record(`Pista ${courtId}: ${msg}`),
      abortIfAlreadyWon: () => won,
    });

    if (result.success && !won) {
      won = true; // reclama la victoria de forma síncrona, sin await de por medio
    }

    return { courtId, ...result };
  }

  const results = await Promise.all(attemptOrder.map(tryCourt));

  const attemptsLog = results.map((r) => ({ courtId: r.courtId, success: r.success, error: r.error }));
  const winner = results.find((r) => r.success);

  if (winner) {
    record(`¡Pista ${winner.courtId} reservada con éxito!`);
    return {
      success: true,
      clubBookingId: winner.clubBookingId,
      bookedCourtId: winner.courtId,
      attemptsLog,
      log,
    };
  }

  record(`No se ha podido reservar ninguna pista disponible (se probaron: ${attemptOrder.join(", ")}).`);

  return {
    success: false,
    error: `No se ha podido reservar ninguna pista disponible (se probaron: ${attemptOrder.join(", ")}).`,
    attemptsLog,
    log,
  };
}
