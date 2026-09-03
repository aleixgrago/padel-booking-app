import rateLimit from "express-rate-limit";

// Login: máximo 10 intentos cada 15 min por IP (evita probar contraseñas a lo bruto)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Espera unos minutos." },
});

// Verificación 2FA: el código es de solo 6 dígitos (10 min de validez), así
// que hay que limitar mucho más los intentos para que no se pueda fuerza-bruta.
export const twoFactorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de verificación. Vuelve a iniciar sesión." },
});

// Registro: evita que un script cree cuentas en bucle
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas cuentas creadas desde aquí. Inténtalo más tarde." },
});
