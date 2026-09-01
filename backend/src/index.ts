import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { reservationsRouter } from "./routes/reservations.routes";
import { courtsRouter } from "./routes/courts.routes";
import { internalRouter } from "./routes/internal.routes";
import { startScheduler } from "./jobs/scheduler.job";

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/reservations", reservationsRouter);
app.use("/courts", courtsRouter);
app.use("/internal", internalRouter);

app.listen(env.port, () => {
  console.log(`🎾 Backend escuchando en http://localhost:${env.port}`);
  // Fallback: si en el futuro se aloja en un servidor siempre encendido
  // (VPS propio, plan de pago), este cron interno también funcionará.
  // En hosting gratuito, el disparador real es el workflow de GitHub Actions.
  startScheduler();
});
