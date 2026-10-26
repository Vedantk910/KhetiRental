import { confirmEmailChange } from "@/server/email-change";
import { parse, readJson, route } from "@/server/http";
import { clientIp } from "@/server/rate-limit";
import { requireUser } from "@/server/session";
import { emailConfirmSchema } from "@/server/validation";

/** The link's token, redeemed by the signed-in person it was issued to. */
export const POST = route(async (req) => {
  const u = await requireUser(req);
  const { token } = parse(emailConfirmSchema, await readJson(req));
  return Response.json({ ok: true, ...(await confirmEmailChange(u, token, clientIp(req))) });
});
