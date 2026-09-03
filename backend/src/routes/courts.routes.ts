import { Router } from "express";
import { COURTS } from "../services/courts.config";
import { env } from "../config/env";

export const courtsRouter = Router();

courtsRouter.get("/", (_req, res) => {
  res.json({ courts: COURTS, bookingWindowDays: env.scheduler.bookingWindowDays });
});
