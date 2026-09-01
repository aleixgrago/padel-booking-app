import { env } from "../config/env";
import type { Reservation, User } from "@prisma/client";
import { decryptSecret } from "./encryption.service";
import { getPrinciSportCourt } from "./princiesport-courts.map";
import { reserveCourt } from "./princiesport.client";

export interface BookingApiResult {
  success: boolean;
  clubBookingId?: string;
  error?: string;
}

/**
 * Punto de entrada usado por el scheduler nocturno. Reserva de verdad en
 * PrinciSport, con toda la lógica (login, graella, selección de franja y
 * confirmación) ya verificada contra dos capturas .har reales, incluyendo
 * el flujo completo de la Pista 5.
 *
 * Mientras CLUB_BOOKING_API_KEY valga "pendiente" en el .env, se simula la
 * llamada (útil para probar el resto del sistema - emails, estados, cron -
 * sin tocar la web real todavía). En cuanto lo pongas a cualquier otro
 * valor, las reservas se hacen de verdad.
 */
export async function bookCourt(
  reservation: Reservation & { user: User }
): Promise<BookingApiResult> {
  const clubPassword = decryptSecret(reservation.user.clubPasswordEncrypted);
  const dateYYYYMMDD = reservation.targetDate.toISOString().slice(0, 10).replace(/-/g, "");

  if (!env.club.baseUrl || env.club.apiKey === "pendiente") {
    console.warn(
      `[booking-api] Llamada SIMULADA (activa CLUB_BOOKING_API_KEY para reservar de verdad) -> ` +
        `usuario club: ${reservation.user.clubUsername}, Pista ${reservation.courtId}, ` +
        `${reservation.timeSlot}, ${dateYYYYMMDD}`
    );
    void clubPassword;
    return { success: true, clubBookingId: `SIMULADO-${reservation.id}` };
  }

  try {
    const { sportCode, courtOptionValue } = getPrinciSportCourt(reservation.courtId);

    const result = await reserveCourt({
      clubUsername: reservation.user.clubUsername,
      clubPassword,
      sportCode,
      courtOptionValue,
      dateYYYYMMDD,
      timeSlotHHmm: reservation.timeSlot,
    });

    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
