import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ACCESS_TOKEN_COOKIE } from "../services/auth-cookie";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: "ADMIN" | "USER";
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Preferimos la cookie httpOnly (no accesible desde JavaScript); el
  // header Bearer se mantiene solo como fallback (ej. para probar la API
  // con curl/Postman sin usar el navegador).
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  const token = cookieToken ?? headerToken;

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string; role: "ADMIN" | "USER" };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o caducado" });
  }
}

/** Debe usarse siempre después de requireAuth. */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ error: "Solo un administrador puede hacer esto." });
  }
  next();
}
