import { env } from "../config/env";
import type { Reservation, User } from "@prisma/client";
import { decryptSecret } from "./encryption.service";
import { getPrinciSportCourt } from "./princiesport-courts.map";
import { reserveCourt } from "./princiesport.client";
import { getBookingAttemptOrder } from "./courts.config";

export interface BookingApiResult {
  success: boolean;
  clubBookingId?: string;
  bookedCourtId?: number;
  error?: string;
  /** Historial de qué se ha probado, útil para depurar y para el email final. */
  attemptsLog: { courtId: number; success: boolean; error?: string }[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Punto de entrada usado por el scheduler nocturno.
 *
 * Si la pista pedida no está disponible a esa hora, prueba automáticamente
 * con las demás pistas del mismo grupo horario (1-4 entre ellas), en orden
 * cíclico a partir de la pedida, hasta conseguir una reserva o agotar todas
 * las opciones.
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

  if (!env.club.baseUrl || env.club.apiKey === "pendiente") {
    console.warn(
      `[booking-api] Llamada SIMULADA (activa CLUB_BOOKING_API_KEY para reservar de verdad) -> ` +
        `usuario club: ${reservation.user.clubUsername}, Pista ${reservation.courtId}, ` +
        `${reservation.timeSlot}, ${dateYYYYMMDD}. Orden de intento: ${attemptOrder.join(", ")}`
    );
    void clubPassword;
    return {
      success: true,
      clubBookingId: `SIMULADO-${reservation.id}`,
      bookedCourtId: reservation.courtId,
      attemptsLog: [{ courtId: reservation.courtId, success: true }],
    };
  }

  const attemptsLog: BookingApiResult["attemptsLog"] = [];

  for (const candidateCourtId of attemptOrder) {
    try {
      const { sportCode, courtOptionValue } = getPrinciSportCourt(candidateCourtId);

      const result = await reserveCourt({
        clubUsername: reservation.user.clubUsername,
        clubPassword,
        sportCode,
        courtOptionValue,
        dateYYYYMMDD,
        timeSlotHHmm: reservation.timeSlot,
      });

      attemptsLog.push({ courtId: candidateCourtId, success: result.success, error: result.error });

      if (result.success) {
        return {
          success: true,
          clubBookingId: result.clubBookingId,
          bookedCourtId: candidateCourtId,
          attemptsLog,
        };
      }

      console.warn(
        `[booking-api] Pista ${candidateCourtId} no disponible para la reserva ${reservation.id} ` +
          `(${result.error}). Probando siguiente alternativa...`
      );
    } catch (err) {
      attemptsLog.push({ courtId: candidateCourtId, success: false, error: (err as Error).message });
    }

    // Pequeña pausa entre intentos para no saturar la web del club
    await sleep(1500);
  }

  return {
    success: false,
    error: `No se ha podido reservar ninguna pista disponible (se probaron: ${attemptOrder.join(", ")}).`,
    attemptsLog,
  };
}
