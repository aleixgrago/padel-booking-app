import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

export async function sendTwoFactorEmail(to: string, code: string) {
  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject: "Tu código de verificación",
    text: `Tu código de acceso es: ${code}. Caduca en 10 minutos.`,
    html: `
      <div style="font-family: sans-serif; padding: 16px;">
        <h2>Código de verificación</h2>
        <p>Usa este código para completar tu inicio de sesión:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p style="color:#666;">Caduca en 10 minutos. Si no has sido tú, ignora este correo.</p>
      </div>
    `,
  });
}

export async function sendReservationResultEmail(
  to: string,
  ok: boolean,
  details: { courtId: number; targetDate: Date; timeSlot: string; error?: string }
) {
  const fecha = details.targetDate.toLocaleDateString("es-ES");
  const subject = ok
    ? `✅ Reserva confirmada: Pista ${details.courtId} - ${fecha}`
    : `⚠️ No se pudo reservar: Pista ${details.courtId} - ${fecha}`;

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text: ok
      ? `Tu reserva en la Pista ${details.courtId} el ${fecha} a las ${details.timeSlot} se ha confirmado.`
      : `No se pudo completar la reserva en la Pista ${details.courtId} el ${fecha} a las ${details.timeSlot}. Motivo: ${details.error ?? "desconocido"}`,
  });
}
