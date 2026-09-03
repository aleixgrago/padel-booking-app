import { env } from "../config/env";

/**
 * Envío de emails vía Resend (API HTTP, https://resend.com).
 *
 * Se usa una API HTTP en vez de SMTP a propósito: los planes gratuitos de
 * hosting (Render incluido) suelen bloquear las conexiones SMTP salientes
 * (puertos 25/465/587), lo que provocaba un "Connection timeout" que además
 * tumbaba todo el proceso al no estar controlado. Con una API HTTP normal
 * (puerto 443) no hay ese problema.
 */
async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.resend.from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ha rechazado el envío (${res.status}): ${body}`);
  }
}

export async function sendTwoFactorEmail(to: string, code: string) {
  await sendEmail(
    to,
    "Tu código de verificación",
    `Tu código de acceso es: ${code}. Caduca en 10 minutos.`,
    `
      <div style="font-family: sans-serif; padding: 16px;">
        <h2>Código de verificación</h2>
        <p>Usa este código para completar tu inicio de sesión:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p style="color:#666;">Caduca en 10 minutos. Si no has sido tú, ignora este correo.</p>
      </div>
    `
  );
}

export async function sendReservationResultEmail(
  to: string,
  ok: boolean,
  details: {
    courtId: number;
    bookedCourtId?: number;
    targetDate: Date;
    timeSlot: string;
    error?: string;
    attemptsLog?: { courtId: number; success: boolean; error?: string }[];
  }
) {
  const fecha = details.targetDate.toLocaleDateString("es-ES");
  const pistaCambiada = ok && details.bookedCourtId && details.bookedCourtId !== details.courtId;

  const subject = ok
    ? pistaCambiada
      ? `✅ Reserva confirmada (Pista ${details.bookedCourtId} en vez de la ${details.courtId}) - ${fecha}`
      : `✅ Reserva confirmada: Pista ${details.courtId} - ${fecha}`
    : `⚠️ No se pudo reservar: Pista ${details.courtId} - ${fecha}`;

  const intentos = details.attemptsLog
    ?.map((a) => `Pista ${a.courtId}: ${a.success ? "OK" : `fallo (${a.error ?? "desconocido"})`}`)
    .join("\n");

  const text = ok
    ? pistaCambiada
      ? `La Pista ${details.courtId} no estaba disponible el ${fecha} a las ${details.timeSlot}, así que se ha reservado automáticamente la Pista ${details.bookedCourtId} en su lugar.`
      : `Tu reserva en la Pista ${details.courtId} el ${fecha} a las ${details.timeSlot} se ha confirmado.`
    : `No se ha podido reservar ninguna pista disponible el ${fecha} a las ${details.timeSlot}.\n\n${intentos ?? ""}`;

  await sendEmail(to, subject, text);
}
