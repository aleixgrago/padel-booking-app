import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import { listUsers, approveUser, rejectUser } from "../controllers/admin.controller";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", listUsers);
adminRouter.post("/users/:id/approve", approveUser);
adminRouter.post("/users/:id/reject", rejectUser);
