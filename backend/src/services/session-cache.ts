import { CookieJar } from "./cookie-jar";
import { loginToPrinciSport } from "./princiesport.client";

interface CachedSession {
  jar: CookieJar;
  createdAt: number;
}

const SESSION_TTL_MS = 3 * 60 * 1000; // 3 minutos: de sobra entre el pre-login y las 20:00h

const cache = new Map<string, CachedSession>();

/**
 * Inicia sesión por adelantado para un usuario y la guarda en memoria unos
 * minutos, lista para usarse en el momento exacto de la reserva sin perder
 * tiempo en el paso de login.
 */
export async function prewarmSession(userId: string, clubUsername: string, clubPassword: string) {
  try {
    const jar = await loginToPrinciSport(clubUsername, clubPassword);
    cache.set(userId, { jar, createdAt: Date.now() });
  } catch (err) {
    // Si falla el pre-login no pasa nada: reserveCourt hará login de cero
    // igualmente si no encuentra una sesión en caché.
    console.warn(`[session-cache] No se ha podido pre-calentar la sesión de ${userId}:`, err);
  }
}

/** Devuelve la sesión pre-calentada si existe y todavía es reciente. */
export function takeSession(userId: string): CookieJar | undefined {
  const cached = cache.get(userId);
  if (!cached) return undefined;

  cache.delete(userId); // de un solo uso
  if (Date.now() - cached.createdAt > SESSION_TTL_MS) return undefined;

  return cached.jar;
}
