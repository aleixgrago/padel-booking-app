import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { issueTwoFactorCode, verifyTwoFactorCode } from "../services/twofa.service";
import { encryptSecret } from "../services/encryption.service";
import { setAccessTokenCookie, clearAccessTokenCookie } from "../services/auth-cookie";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  // Credenciales del usuario en la web del club (PrinciSport), necesarias
  // para que el robot pueda iniciar sesión y reservar en su nombre.
  clubUsername: z.string().min(1, "Indica tu código de usuario de PrinciSport"),
  clubPassword: z.string().min(1, "Indica tu contraseña de PrinciSport"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verifySchema = z.object({
  tempToken: z.string(),
  code: z.string().length(6),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, name, password, clubUsername, clubPassword } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const clubPasswordEncrypted = encryptSecret(clubPassword);

  // El primer usuario que se registra en una instalación nueva (todavía no
  // hay nadie en la tabla) se convierte automáticamente en administrador y
  // queda aprobado, para no quedarse fuera de su propia app. Todos los
  // siguientes quedan pendientes de aprobación por defecto.
  const isFirstUser = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      clubUsername,
      clubPasswordEncrypted,
      ...(isFirstUser ? { role: "ADMIN", status: "APPROVED", approvedAt: new Date() } : {}),
    },
  });

  return res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    isFirstUser,
  });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  if (user.status === "PENDING") {
    return res
      .status(403)
      .json({ error: "Tu cuenta todavía no ha sido aprobada por el administrador." });
  }
  if (user.status === "REJECTED") {
    return res.status(403).json({ error: "Tu solicitud de acceso ha sido rechazada." });
  }

  // Paso 1 superado: enviamos el código 2FA y devolvemos un token temporal
  try {
    await issueTwoFactorCode(user.id, user.email);
  } catch (err) {
    console.error("[auth] Error en el login al emitir el código 2FA:", err);
    return res.status(502).json({ error: (err as Error).message });
  }

  const tempToken = jwt.sign({ userId: user.id, step: "2fa" }, env.tempTokenSecret, {
    expiresIn: "10m",
  });

  return res.json({ tempToken, message: "Código enviado por email" });
}

export async function verifyTwoFactor(req: Request, res: Response) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { tempToken, code } = parsed.data;

  let userId: string;
  try {
    const payload = jwt.verify(tempToken, env.tempTokenSecret) as { userId: string; step: string };
    if (payload.step !== "2fa") throw new Error("token inválido");
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "Token temporal inválido o caducado, vuelve a iniciar sesión" });
  }

  const isValid = await verifyTwoFactorCode(userId, code);
  if (!isValid) {
    return res.status(401).json({ error: "Código incorrecto o caducado" });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const accessToken = jwt.sign({ userId, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  // El token va en una cookie httpOnly: JavaScript no puede leerlo (ni un
  // script inyectado por XSS, ni una extensión curiosa del navegador).
  setAccessTokenCookie(res, accessToken, env.jwtExpiresIn * 1000);

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

export async function logout(_req: Request, res: Response) {
  clearAccessTokenCookie(res);
  return res.json({ ok: true });
}
