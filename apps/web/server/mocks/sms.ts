// SMS mock (D-11): prints to the server log in dev. A real provider plugs in behind sendSms.
import { mocksMayLog } from "./flags";

const outbox: { to: string; text: string }[] = [];

export function sendSms(to: string, text: string) {
  outbox.push({ to, text });
  if (outbox.length > 100) outbox.shift();
  if (mocksMayLog()) console.info(`[sms-mock] to ${to}: ${text}`);
  else console.info(`[sms-mock] message to …${to.slice(-4)} not sent (no SMS provider configured)`);
}

/** Tests read what would have been sent. */
export const lastSms = (to: string) => outbox.findLast((m) => m.to === to)?.text;
