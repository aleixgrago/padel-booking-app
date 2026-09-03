import { prisma } from "../db/prisma";
import { sendTwoFactorEmail } from "./email.service";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

export async function issueTwoFactorCode(userId: string, email: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await prisma.twoFactorCode.create({
    data: { userId, code, expiresAt },
  });

  try {
    await sendTwoFactorEmail(email, code);
  } catch (err) {
    console.error("[twofa] Error enviando el email del código:", err);
    throw new Error(
      "No se ha podido enviar el email con el código de verificación. Inténtalo de nuevo en unos minutos."
    );
  }
}

export async function verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  const record = await prisma.twoFactorCode.findFirst({
    where: { userId, code, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  await prisma.twoFactorCode.update({
    where: { id: record.id },
    data: { used: true },
  });

  return true;
}
