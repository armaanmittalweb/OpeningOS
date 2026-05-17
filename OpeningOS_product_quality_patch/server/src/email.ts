import nodemailer from 'nodemailer';
import { query } from './db.js';

type EmailPayload = { to: string; subject: string; text: string; html?: string; userId?: string; template?: string; payload?: Record<string, unknown> };

function configured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

export async function sendEmail(mail: EmailPayload): Promise<{ sent: boolean; queued?: boolean }> {
  if (!configured()) {
    if (mail.userId) {
      await query('insert into notifications(user_id, channel, template, subject, body, payload) values($1,$2,$3,$4,$5,$6)', [mail.userId, 'in_app', mail.template || 'email-fallback', mail.subject, mail.text, mail.payload || {}]).catch(() => undefined);
    }
    console.log('[email-disabled]', mail.to, mail.subject, mail.text.slice(0, 120));
    return { sent: false, queued: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  if (mail.userId) {
    await query('insert into notifications(user_id, channel, template, subject, body, payload, sent_at) values($1,$2,$3,$4,$5,$6,now())', [mail.userId, 'email', mail.template || 'email', mail.subject, mail.text, mail.payload || {}]).catch(() => undefined);
  }
  return { sent: true };
}
