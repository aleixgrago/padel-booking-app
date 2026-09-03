import cron from "node-cron";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { bookCourt } from "../services/booking-api.client";
import { sendReservationResultEmail } from "../services/email.service";
import { prewarmSession } from "../services/session-cache";
import { decryptSecret } from "../services/encryption.service";

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
        bookedCourtId: result.bookedCourtId,
        lastError: result.error,
        executionLog: result.log as any,
        executedAt: new Date(),
      },
    });

    try {
      await sendReservationResultEmail(reservation.user.email, result.success, {
        courtId: reservation.courtId,
        bookedCourtId: result.bookedCourtId,
        targetDate: reservation.targetDate,
        timeSlot: reservation.timeSlot,
        error: result.error,
        attemptsLog: result.attemptsLog,
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

  // Unos minutos antes, "pre-calentamos" la sesión de PrinciSport de cada
  // usuario que tenga una reserva para hoy a las 20:00h, para no perder
  // tiempo haciendo login justo en el momento crítico.
  cron.schedule("58 19 * * *", () => {
    prewarmTonightsSessions().catch((err) => {
      console.error("[scheduler] Error precalentando sesiones:", err);
    });
  });

  console.log(`[scheduler] Job registrado con expresión cron "${env.scheduler.cron}" (+ pre-login a las 19:58)`);
}

/**
 * Busca las reservas que se van a ejecutar dentro de los próximos minutos
 * y deja lista la sesión de PrinciSport de cada usuario afectado, para que
 * el job de las 20:00h no tenga que hacer login desde cero.
 */
async function prewarmTonightsSessions() {
  const now = new Date();
  const in5min = new Date(now.getTime() + 5 * 60 * 1000);

  const upcoming = await prisma.reservation.findMany({
    where: { status: "SCHEDULED", executeAt: { gte: now, lte: in5min } },
    include: { user: true },
    distinct: ["userId"],
  });

  if (upcoming.length === 0) return;

  console.log(`[scheduler] Pre-calentando sesión para ${upcoming.length} usuario(s)...`);

  await Promise.all(
    upcoming.map((r) => prewarmSession(r.userId, r.user.clubUsername, decryptSecret(r.user.clubPasswordEncrypted)))
  );
}
