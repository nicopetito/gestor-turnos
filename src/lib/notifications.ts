import { Resend } from 'resend';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

const FROM_EMAIL = () =>
  process.env.RESEND_FROM_EMAIL ?? 'Canchas <reservas@resend.dev>';

const APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Sends an email. Returns true on success, never throws. */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    await resend.emails.send({ from: FROM_EMAIL(), ...params });
    return true;
  } catch (err) {
    console.error('[Resend] Error al enviar email:', err);
    return false;
  }
}

// ── Shared HTML helpers ───────────────────────────────────────────────────────

const base = (content: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        ${content}
      </table>
      <p style="margin-top:20px;font-size:11px;color:#9ca3af;">
        Mensaje automático — no respondas este email.
      </p>
    </td></tr>
  </table>
</body>
</html>`;

const headerBar = (color: string, emoji: string, title: string) => `
<tr>
  <td style="background:${color};padding:28px;text-align:center;">
    <div style="font-size:40px;line-height:1;">${emoji}</div>
    <h1 style="margin:10px 0 0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${title}</h1>
  </td>
</tr>`;

const detailRow = (label: string, value: string) => `
<tr>
  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;color:#6b7280;">${label}</td>
      <td style="font-size:13px;font-weight:600;color:#111827;text-align:right;">${value}</td>
    </tr></table>
  </td>
</tr>`;

const ctaButton = (href: string, label: string, color = '#2563eb') => `
<a href="${href}" style="display:block;margin-top:20px;background:${color};color:#ffffff;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:600;font-size:14px;">
  ${label}
</a>`;

// ── Templates ─────────────────────────────────────────────────────────────────

export async function notifyBookingConfirmed(params: {
  name: string;
  email: string;
  date: string;
  courtName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}) {
  const { name, email, date, courtName, startTime, endTime, durationMinutes } = params;
  const dateLabel = format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es });

  const html = base(`
    ${headerBar('#16a34a', '✅', 'Reserva confirmada')}
    <tr><td style="padding:28px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Hola <strong>${name}</strong>, tu turno quedó registrado correctamente.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Fecha', `<span style="text-transform:capitalize">${dateLabel}</span>`)}
        ${detailRow('Cancha', courtName)}
        ${detailRow('Horario', `${startTime} – ${endTime}`)}
        ${detailRow('Duración', `${durationMinutes} minutos`)}
      </table>
      ${ctaButton(`${APP_URL()}/mis-reservas`, 'Ver mis reservas')}
      <p style="margin-top:14px;font-size:12px;color:#9ca3af;text-align:center;">
        Podés cancelar hasta 24 h antes sin penalidad.
      </p>
    </td></tr>
  `);

  return sendEmail({
    to:      email,
    subject: `✅ Turno confirmado — ${courtName} — ${startTime}`,
    html,
  });
}

export async function notifyBookingReminder(params: {
  name: string;
  email: string;
  date: string;
  courtName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}) {
  const { name, email, date, courtName, startTime, endTime, durationMinutes } = params;
  const dateLabel = format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es });

  const html = base(`
    ${headerBar('#2563eb', '⏰', 'Recordatorio de turno')}
    <tr><td style="padding:28px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Hola <strong>${name}</strong>, te recordamos que mañana tenés un turno reservado.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Fecha', `<span style="text-transform:capitalize">${dateLabel}</span>`)}
        ${detailRow('Cancha', courtName)}
        ${detailRow('Horario', `${startTime} – ${endTime}`)}
        ${detailRow('Duración', `${durationMinutes} minutos`)}
      </table>
      ${ctaButton(`${APP_URL()}/mis-reservas`, 'Ver mis reservas', '#2563eb')}
      <p style="margin-top:14px;font-size:12px;color:#9ca3af;text-align:center;">
        Si necesitás cancelar, hacelo antes de las ${startTime} de hoy para evitar cancelación tardía.
      </p>
    </td></tr>
  `);

  return sendEmail({
    to:      email,
    subject: `⏰ Recordatorio: turno mañana — ${courtName} — ${startTime}`,
    html,
  });
}

export async function notifyBookingCancelled(params: {
  name: string;
  email: string;
  date: string;
  courtName: string;
  startTime: string;
  isLate: boolean;
}) {
  const { name, email, date, courtName, startTime, isLate } = params;
  const dateLabel = format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es });

  const lateNote = isLate
    ? `<div style="margin-top:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;font-size:13px;color:#c2410c;">
        ⚠️ La cancelación fue con menos de 24 h de anticipación y quedó registrada como <strong>cancelación tardía</strong>.
       </div>`
    : '';

  const html = base(`
    ${headerBar('#dc2626', '❌', 'Reserva cancelada')}
    <tr><td style="padding:28px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Hola <strong>${name}</strong>, tu turno fue cancelado.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Fecha', `<span style="text-transform:capitalize">${dateLabel}</span>`)}
        ${detailRow('Cancha', courtName)}
        ${detailRow('Horario', startTime)}
      </table>
      ${lateNote}
      ${ctaButton(`${APP_URL()}/reservar`, 'Hacer una nueva reserva')}
    </td></tr>
  `);

  return sendEmail({
    to:      email,
    subject: `❌ Turno cancelado — ${courtName} — ${startTime}`,
    html,
  });
}
