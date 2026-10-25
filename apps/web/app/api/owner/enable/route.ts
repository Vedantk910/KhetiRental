import { parse, readJson, route } from "@/server/http";
import { enableOwner } from "@/server/owner";
import { requireUser } from "@/server/session";
import { emptySchema } from "@/server/validation";

/** "Turn on owner mode" (UI-SPEC §3.1): adds the owner role to the caller, nothing else. */
export const POST = route(async (req) => {
  const u = await requireUser(req);
  parse(emptySchema, await readJson(req));
  return Response.json(await enableOwner(u));
});
