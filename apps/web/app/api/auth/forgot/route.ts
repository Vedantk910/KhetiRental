import { parse, readJson, route } from "@/server/http";
import { requestPasswordReset } from "@/server/passwords";
import { clientIp, limit } from "@/server/rate-limit";
import { forgotSchema } from "@/server/validation";

/** Same answer whether or not the account exists (UI-SPEC §4.3); the link is logged in dev. */
export const POST = route(async (req) => {
  await limit("signupIp", clientIp(req));
  const { email } = parse(forgotSchema, await readJson(req));
  await requestPasswordReset(email);
  return Response.json({ ok: true });
});
