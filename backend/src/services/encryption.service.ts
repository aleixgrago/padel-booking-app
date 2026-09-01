import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";

// La clave debe tener 32 bytes. Se deriva de ENCRYPTION_KEY con sha256
// para admitir cualquier string como secreto en el .env.
function getKey(): Buffer {
  return crypto.createHash("sha256").update(env.encryptionKey).digest();
}

/**
 * Cifra un texto (p.ej. la contraseña del usuario en PrinciSport) para
 * guardarlo en la base de datos. Nunca se guarda en texto plano.
 */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Formato: iv.authTag.encrypted, todo en base64
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

/**
 * Descifra el secreto guardado. Solo se usa en el momento de llamar a la
 * API del club (booking-api.client.ts), nunca se expone al frontend.
 */
export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, encryptedB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
