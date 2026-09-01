import { Router } from "express";
import { env } from "../config/env";
import { runDueReservations } from "../jobs/scheduler.job";

export const internalRouter = Router();

/**
 * Endpoint pensado para ser llamado por un cron externo GRATUITO
 * (GitHub Actions, cron-job.org, etc.) en lugar de depender de que el
 * proceso Node esté siempre despierto (los planes gratuitos de Render,
 * por ejemplo, duermen el servicio tras 15 min sin tráfico).
 *
 * No usa el login de usuario: se protege con una clave secreta compartida
 * (CRON_SECRET) que solo conocen el backend y el workflow programado.
 *
 * Es seguro llamarlo más de una vez o "de más": solo actúa sobre reservas
 * en estado SCHEDULED cuya executeAt ya ha llegado, así que llamadas
 * repetidas o de días distintos con horario de verano/invierno no duplican
 * ninguna reserva.
 */
internalRouter.post("/run-scheduler", async (req, res) => {
  const providedSecret = req.headers["x-cron-secret"];

  if (!env.cronSecret || providedSecret !== env.cronSecret) {
    return res.status(401).json({ error: "Secreto de cron inválido" });
  }

  await runDueReservations();
  return res.json({ ok: true, ranAt: new Date().toISOString() });
});
