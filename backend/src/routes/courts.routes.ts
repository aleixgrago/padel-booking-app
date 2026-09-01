import { Router } from "express";
import { COURTS } from "../services/courts.config";

export const courtsRouter = Router();

courtsRouter.get("/", (_req, res) => {
  res.json(COURTS);
});
