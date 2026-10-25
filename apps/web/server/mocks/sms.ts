// SMS (D-11): the mock prints to the server log in dev. A real provider plugs in by adding an entry to PROVIDERS
// and setting SMS_PROVIDER=<name> and SMS_API_KEY; none is configured, so a real deployment has no phone login.
import { mocksMayLog } from "./flags";

type SmsProvider = (to: string, text: string, apiKey: string) => Promise<void>;
const PROVIDERS: Partial<Record<string, SmsProvider>> = {};

const outbox: { to: string; text: string }[] = [];

function provider() {
  const send = PROVIDERS[process.env.SMS_PROVIDER ?? ""];
  const key = process.env.SMS_API_KEY;
  return send && key ? (to: string, text: string) => send(to, text, key) : undefined;
}

/** Phone login needs a way to deliver the code: a configured provider, or the log where mocks may print. */
export const phoneLoginAvailable = () => mocksMayLog() || provider() !== undefined;

/** The code is returned to the page only when the mock, not a real provider, "sends" it. */
export const smsIsMock = () => provider() === undefined;

export async function sendSms(to: string, text: string) {
  const real = provider();
  if (real) return real(to, text);
  outbox.push({ to, text });
  if (outbox.length > 100) outbox.shift();
  if (mocksMayLog()) console.info(`[sms-mock] to ${to}: ${text}`);
}

/** Tests read what would have been sent. */
export const lastSms = (to: string) => outbox.findLast((m) => m.to === to)?.text;
