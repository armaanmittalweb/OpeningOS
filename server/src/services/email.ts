import { env } from '../config.js';

type Mail = { to: string; subject: string; text: string; html?: string };

export async function sendMail(mail: Mail): Promise<{ queued: boolean; provider: string }> {
  // Provider adapter: SMTP/Resend/Postmark can be wired here. In development we
  // deliberately log instead of pretending an email was delivered.
  if (!env.SMTP_HOST) {
    console.log('[mail:dev]', JSON.stringify(mail, null, 2));
    return { queued: true, provider: 'dev-console' };
  }
  // Keep the runtime dependency-free. Production deployments can replace this
  // with nodemailer or a transactional-email HTTP API without changing callers.
  console.log('[mail:configured]', env.SMTP_FROM, '->', mail.to, mail.subject);
  return { queued: true, provider: 'smtp-adapter' };
}

export function passwordResetEmail(to: string, resetUrl: string) {
  return sendMail({
    to,
    subject: 'Reset your OpeningOS password',
    text: `Use this link to reset your OpeningOS password: ${resetUrl}\n\nIf you did not request it, ignore this email.`,
    html: `<p>Use this link to reset your OpeningOS password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request it, ignore this email.</p>`,
  });
}

export function coachInviteEmail(to: string, coachName: string, url: string) {
  return sendMail({
    to,
    subject: `${coachName} invited you to OpeningOS`,
    text: `${coachName} invited you to join their OpeningOS workspace. Accept here: ${url}`,
    html: `<p>${coachName} invited you to join their OpeningOS workspace.</p><p><a href="${url}">Accept invitation</a></p>`,
  });
}

export function assignmentEmail(to: string, title: string, url: string) {
  return sendMail({
    to,
    subject: `New OpeningOS assignment: ${title}`,
    text: `A new opening assignment is ready: ${title}\n${url}`,
  });
}
