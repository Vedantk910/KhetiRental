import { changePhone } from "@/server/account";
import { parse, readJson, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { phoneChangeSchema } from "@/server/validation";

/** Settings → change number. The code comes from /api/auth/otp, sent to the new number. */
export const POST = route(async (req) => {
  const u = await requireUser(req);
  const { phone, code } = parse(phoneChangeSchema, await readJson(req));
  return Response.json(await changePhone(u, phone, code));
});
