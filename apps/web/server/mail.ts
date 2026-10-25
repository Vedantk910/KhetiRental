// Email (D-11): with SMTP_URL set the message goes out through nodemailer, otherwise it lands in an in-memory outbox.
import { createTransport } from "nodemailer";
import { mocksMayLog } from "./mocks/flags";

export type Mail = { to: string; subject: string; text: string };

const outbox: Mail[] = [];

export const mailConfigured = () => Boolean(process.env.SMTP_URL);

export async function sendMail(m: Mail) {
  const url = process.env.SMTP_URL;
  if (!url) {
    outbox.push(m);
    if (outbox.length > 100) outbox.shift();
    console.info(
      mocksMayLog()
        ? `[mail-mock] to ${m.to}: ${m.subject}\n${m.text}`
        : `[mail-mock] "${m.subject}" not sent (no SMTP_URL)`,
    );
    return;
  }
  const from = process.env.MAIL_FROM || decodeURIComponent(new URL(url).username);
  await createTransport(url).sendMail({ from, ...m });
}

/** Tests read what would have been sent. */
export const lastMail = (to: string) => outbox.findLast((m) => m.to === to);

/**
 * The public origin for links in emails. Only ever SITE_URL: a Host header is chosen by the caller, so a
 * link built from it could point a victim's reset email at an attacker's site.
 */
export function siteUrl(): string | null {
  const raw = process.env.SITE_URL;
  if (!raw) return mocksMayLog() ? "http://localhost:3000" : null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}
