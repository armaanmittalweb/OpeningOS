import { env } from '../config.js';
import nodemailer from 'nodemailer';

type Mail = { to: string; subject: string; text: string; html?: string };

type SendResult = { queued: boolean; provider: string; messageId?: string };

function htmlEscape(value: string) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function baseHtml(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0d1216;color:#eef4ef;font-family:Inter,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1216;padding:28px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#121a20;border:1px solid #25313a;border-radius:20px;padding:28px"><tr><td><div style="font-size:14px;color:#91b89f;font-weight:700;letter-spacing:.04em;text-transform:uppercase">OpeningOS</div><h1 style="font-size:26px;line-height:1.15;margin:10px 0 16px;color:#ffffff">${htmlEscape(title)}</h1><div style="font-size:15px;line-height:1.6;color:#d5dfd8">${body}</div><p style="font-size:12px;color:#87938b;margin-top:26px">If you did not request this, you can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
}

function transporter() {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT || 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined,
  });
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const tx = transporter();
  if (!tx) {
    console.log('[mail:dev-console]', JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text }, null, 2));
    return { queued: true, provider: 'dev-console' };
  }
  const from = env.SMTP_FROM || 'OpeningOS <no-reply@openingos.app>';
  const info = await tx.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  return { queued: true, provider: 'smtp', messageId: info.messageId };
}

export function passwordResetEmail(to: string, resetUrl: string) {
  const safeUrl = htmlEscape(resetUrl);
  return sendMail({
    to,
    subject: 'Reset your OpeningOS password',
    text: `Use this link to reset your OpeningOS password: ${resetUrl}\n\nIf you did not request it, ignore this email.`,
    html: baseHtml('Reset your password', `<p>Use this secure link to reset your OpeningOS password:</p><p><a href="${safeUrl}" style="display:inline-block;background:#91b89f;color:#0d1216;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700">Reset password</a></p><p style="word-break:break-all;color:#aab7af">${safeUrl}</p>`),
  });
}

export function coachInviteEmail(to: string, coachName: string, url: string) {
  const safeUrl = htmlEscape(url);
  const safeCoach = htmlEscape(coachName || 'Your coach');
  return sendMail({
    to,
    subject: `${coachName} invited you to OpeningOS`,
    text: `${coachName} invited you to join their OpeningOS workspace. Accept here: ${url}`,
    html: baseHtml('You have a coach invitation', `<p>${safeCoach} invited you to join their OpeningOS workspace.</p><p><a href="${safeUrl}" style="display:inline-block;background:#91b89f;color:#0d1216;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700">Accept invitation</a></p>`),
  });
}

export function assignmentEmail(to: string, title: string, url: string) {
  const safeUrl = htmlEscape(url);
  const safeTitle = htmlEscape(title);
  return sendMail({
    to,
    subject: `New OpeningOS assignment: ${title}`,
    text: `A new opening assignment is ready: ${title}\n${url}`,
    html: baseHtml('New opening assignment', `<p>Your coach assigned:</p><h2 style="color:#fff">${safeTitle}</h2><p><a href="${safeUrl}" style="display:inline-block;background:#91b89f;color:#0d1216;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700">Open assignment</a></p>`),
  });
}
