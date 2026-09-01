import { Router } from "express";
import { register, login, verifyTwoFactor } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/verify-2fa", verifyTwoFactor);
