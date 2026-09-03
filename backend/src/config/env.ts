import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu .env`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: required("FRONTEND_URL", "http://localhost:5173"),
  isProduction: process.env.NODE_ENV === "production",

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN ?? 60 * 60 * 24 * 7), // segons, por defecto 7 días
  tempTokenSecret: required("TEMP_TOKEN_SECRET"),

  resend: {
    apiKey: required("RESEND_API_KEY"),
    from: process.env.MAIL_FROM ?? "Padel Booking <onboarding@resend.dev>",
  },

  club: {
    baseUrl: process.env.CLUB_BOOKING_API_BASE_URL ?? "",
    apiKey: process.env.CLUB_BOOKING_API_KEY ?? "",
  },

  scheduler: {
    cron: process.env.SCHEDULER_CRON ?? "0 20 * * *",
    bookingWindowDays: Number(process.env.BOOKING_WINDOW_DAYS ?? 4),
  },

  cronSecret: process.env.CRON_SECRET ?? "",

  // Clave usada para cifrar/descifrar la contraseña de PrinciSport de cada
  // usuario. Genera una cadena larga y aleatoria, ej: openssl rand -hex 32
  encryptionKey: required("ENCRYPTION_KEY"),
};
