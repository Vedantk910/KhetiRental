import { after } from "next/server";
import { mailConfigured } from "@/server/mail";
import { parse, readJson, route } from "@/server/http";
import { mocksMayLog } from "@/server/mocks/flags";
import { requestPasswordReset, sendResetEmail } from "@/server/passwords";
import { clientIp, limit } from "@/server/rate-limit";
import { forgotSchema } from "@/server/validation";

/** Same answer whether or not the account exists (UI-SPEC §4.3). The email goes out after the response, so timing doesn't tell either. */
export const POST = route(async (req) => {
  await limit("signupIp", clientIp(req));
  const { email } = parse(forgotSchema, await readJson(req));
  await limit("resetEmail", email);
  const token = await requestPasswordReset(email);
  if (token)
    after(() =>
      sendResetEmail(email, token).catch((e: unknown) => {
        console.error("[mail] password reset email failed", e);
      }),
    );
  // Without SMTP, dev and e2e also hand the link back so the page can show it.
  return Response.json({
    ok: true,
    ...(token && mocksMayLog() && !mailConfigured() ? { devLink: `/login/reset?token=${token}` } : {}),
  });
});
