import { parse, readJson, route } from "@/server/http";
import { mocksMayLog } from "@/server/mocks/flags";
import { requestPasswordReset } from "@/server/passwords";
import { clientIp, limit } from "@/server/rate-limit";
import { forgotSchema } from "@/server/validation";

/** Same answer whether or not the account exists (UI-SPEC §4.3); the link is logged in dev. */
export const POST = route(async (req) => {
  await limit("signupIp", clientIp(req));
  const { email } = parse(forgotSchema, await readJson(req));
  const token = await requestPasswordReset(email);
  // The mock "email": in dev and e2e the link is also handed back so the page can show it.
  return Response.json({
    ok: true,
    ...(token && mocksMayLog() ? { devLink: `/login/reset?token=${token}` } : {}),
  });
});
