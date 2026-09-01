import cron from "node-cron";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { bookCourt } from "../services/booking-api.client";
import { sendReservationResultEmail } from "../services/email.service";

/**
 * Busca todas las reservas SCHEDULED cuya ventana de ejecución (executeAt)
 * ya ha llegado, e intenta realizarlas contra la API del club.
 *
 * Se puede llamar tanto desde el cron diario como manualmente (endpoint
 * /reservations/run-now) para poder probarlo sin esperar a las 20:00h.
 */
export async function runDueReservations() {
  const now = new Date();

  const due = await prisma.reservation.findMany({
    where: {
      status: "SCHEDULED",
      executeAt: { lte: now },
    },
    include: { user: true },
  });

  if (due.length === 0) {
    console.log(`[scheduler] ${now.toISOString()} - No hay reservas pendientes de ejecutar.`);
    return;
  }

  console.log(`[scheduler] ${now.toISOString()} - Ejecutando ${due.length} reserva(s)...`);

  for (const reservation of due) {
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });

    const result = await bookCourt(reservation);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: result.success ? "CONFIRMED" : "FAILED",
        clubBookingId: result.clubBookingId,
        lastError: result.error,
        executedAt: new Date(),
      },
    });

    try {
      await sendReservationResultEmail(reservation.user.email, result.success, {
        courtId: reservation.courtId,
        targetDate: reservation.targetDate,
        timeSlot: reservation.timeSlot,
        error: result.error,
      });
    } catch (mailErr) {
      console.error("[scheduler] Error enviando email de resultado:", mailErr);
    }
  }
}

export function startScheduler() {
  // Por defecto: "0 20 * * *" -> todos los días a las 20:00h
  cron.schedule(env.scheduler.cron, () => {
    runDueReservations().catch((err) => {
      console.error("[scheduler] Error inesperado ejecutando reservas:", err);
    });
  });

  console.log(`[scheduler] Job registrado con expresión cron "${env.scheduler.cron}"`);
}
