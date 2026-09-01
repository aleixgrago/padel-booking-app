import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createReservation,
  listReservations,
  cancelReservation,
  runNow,
} from "../controllers/reservations.controller";

export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);

reservationsRouter.post("/", createReservation);
reservationsRouter.get("/", listReservations);
reservationsRouter.delete("/:id", cancelReservation);
reservationsRouter.post("/run-now", runNow); // útil en desarrollo para probar sin esperar al cron
