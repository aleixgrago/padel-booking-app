import { Response } from "express";
import { env } from "../config/env";

export const ACCESS_TOKEN_COOKIE = "accessToken";

/**
 * En producción, el frontend (Vercel) y el backend (Render) están en
 * dominios distintos, así que la cookie tiene que ser "cross-site":
 * eso exige SameSite=None + Secure (solo viaja por HTTPS).
 *
 * En local (localhost:5173 -> localhost:4000) son orígenes distintos pero
 * el mismo "site", así que basta con SameSite=Lax y no hace falta Secure
 * (de hecho, Secure=true rompería las cookies en http://localhost).
 */
function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: (env.isProduction ? "none" : "lax") as "none" | "lax",
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export function setAccessTokenCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, cookieOptions(maxAgeMs));
}

export function clearAccessTokenCookie(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions());
}
