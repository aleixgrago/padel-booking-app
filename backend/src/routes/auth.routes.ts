import { Router } from "express";
import { register, login, verifyTwoFactor, logout } from "../controllers/auth.controller";
import { loginLimiter, twoFactorLimiter, registerLimiter } from "../middleware/rate-limit.middleware";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, register);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/verify-2fa", twoFactorLimiter, verifyTwoFactor);
authRouter.post("/logout", logout);
