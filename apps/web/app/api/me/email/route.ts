import { requestEmailChange } from "@/server/email-change";
import { parse, readJson, route } from "@/server/http";
import { clientIp } from "@/server/rate-limit";
import { requireUser } from "@/server/session";
import { emailChangeSchema } from "@/server/validation";

/** Settings → change email: mails a confirm link to the new address. Nothing changes until it is opened. */
export const POST = route(async (req) => {
  const u = await requireUser(req);
  const body = parse(emailChangeSchema, await readJson(req));
  return Response.json({ ok: true, ...(await requestEmailChange(u, body, clientIp(req))) });
});
