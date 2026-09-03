import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { reservationsRouter } from "./routes/reservations.routes";
import { courtsRouter } from "./routes/courts.routes";
import { internalRouter } from "./routes/internal.routes";
import { adminRouter } from "./routes/admin.routes";
import { startScheduler } from "./jobs/scheduler.job";

const app = express();

// Render (y la mayoría de hostings gratuitos) ponen el backend detrás de un
// proxy inverso. Sin esto, express-rate-limit vería siempre la misma IP
// (la del proxy) para todo el mundo, y las cabeceras Secure de las cookies
// no se calcularían bien.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/reservations", reservationsRouter);
app.use("/courts", courtsRouter);
app.use("/internal", internalRouter);
app.use("/admin", adminRouter);

app.listen(env.port, () => {
  console.log(`🎾 Backend escuchando en http://localhost:${env.port}`);
  // Fallback: si en el futuro se aloja en un servidor siempre encendido
  // (VPS propio, plan de pago), este cron interno también funcionará.
  // En hosting gratuito, el disparador real es el workflow de GitHub Actions.
  startScheduler();
});

// Red de seguridad: un error asíncrono no controlado (ej. un fallo de red
// puntual) no debe tumbar todo el servidor. Se registra y se sigue.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
