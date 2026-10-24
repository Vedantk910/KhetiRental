import { parse, readJson, route } from "@/server/http";
import { resetPassword } from "@/server/passwords";
import { resetSchema } from "@/server/validation";

export const POST = route(async (req) => {
  const { token, password } = parse(resetSchema, await readJson(req));
  await resetPassword(token, password);
  return Response.json({ ok: true });
});
