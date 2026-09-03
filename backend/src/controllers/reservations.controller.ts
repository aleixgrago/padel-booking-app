import { Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { computeExecuteAt, isValidSlot } from "../services/courts.config";
import { runDueReservations } from "../jobs/scheduler.job";
import { bookCourt } from "../services/booking-api.client";
import { sendReservationResultEmail } from "../services/email.service";

const createSchema = z.object({
  courtId: z.number().int().min(1).max(5),
  targetDate: z.string(), // "2026-09-02"
  timeSlot: z.string(),   // "16:30"
});

export async function createReservation(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { courtId, targetDate, timeSlot } = parsed.data;

  if (!isValidSlot(courtId, timeSlot)) {
    return res.status(400).json({ error: "Esa franja horaria no existe para la pista indicada" });
  }

  const parsedDate = new Date(`${targetDate}T00:00:00`);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: "Fecha objetivo inválida" });
  }

  const executeAt = computeExecuteAt(parsedDate);
  if (executeAt.getTime() < Date.now()) {
    return res.status(400).json({
      error:
        "La fecha elegida está demasiado próxima: la ventana de reserva del club para ese día ya se habría abierto en el pasado.",
    });
  }

  const reservation = await prisma.reservation.create({
    data: {
      userId: req.userId!,
      courtId,
      timeSlot,
      targetDate: parsedDate,
      executeAt,
    },
  });

  return res.status(201).json(reservation);
}

export async function listReservations(req: AuthenticatedRequest, res: Response) {
  const { status } = req.query;

  const reservations = await prisma.reservation.findMany({
    where: {
      userId: req.userId!,
      ...(typeof status === "string" ? { status: status as any } : {}),
    },
    orderBy: { targetDate: "asc" },
  });

  return res.json(reservations);
}

export async function cancelReservation(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  const reservation = await prisma.reservation.findFirst({
    where: { id, userId: req.userId! },
  });

  if (!reservation) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }

  if (reservation.status !== "SCHEDULED") {
    return res.status(400).json({ error: "Solo se pueden cancelar reservas todavía programadas" });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return res.json(updated);
}

// Endpoint de utilidad para probar el flujo completo sin esperar a las 20:00h
export async function runNow(_req: AuthenticatedRequest, res: Response) {
  await runDueReservations();
  return res.json({ message: "Ejecución manual completada, revisa el listado de reservas" });
}

/**
 * Reserva inmediata: para fechas cuya ventana de reserva (4 días antes a
 * las 20:00h) YA ha llegado, no tiene sentido esperar al cron nocturno.
 * Este endpoint hace la llamada real a PrinciSport al momento y devuelve
 * el resultado directamente en la respuesta.
 */
export async function bookNow(req: AuthenticatedRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { courtId, targetDate, timeSlot } = parsed.data;

  if (!isValidSlot(courtId, timeSlot)) {
    return res.status(400).json({ error: "Esa franja horaria no existe para la pista indicada" });
  }

  const parsedDate = new Date(`${targetDate}T00:00:00`);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: "Fecha objetivo inválida" });
  }

  const executeAt = computeExecuteAt(parsedDate);
  if (executeAt.getTime() > Date.now()) {
    return res.status(400).json({
      error: "Todavía no se puede reservar esta fecha: la ventana del club no se ha abierto aún. Usa 'Programar reserva' en su lugar.",
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });

  const reservation = await prisma.reservation.create({
    data: {
      userId: req.userId!,
      courtId,
      timeSlot,
      targetDate: parsedDate,
      executeAt,
      status: "PROCESSING",
    },
  });

  const result = await bookCourt({ ...reservation, user });

  const updated = await prisma.reservation.update({
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
    await sendReservationResultEmail(user.email, result.success, {
      courtId,
      bookedCourtId: result.bookedCourtId,
      targetDate: parsedDate,
      timeSlot,
      error: result.error,
      attemptsLog: result.attemptsLog,
    });
  } catch (mailErr) {
    console.error("[reservations] Error enviando email de resultado (reserva inmediata):", mailErr);
  }

  return res.json(updated);
}
