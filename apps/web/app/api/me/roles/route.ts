import { setMyRoles } from "@/server/account";
import { parse, readJson, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { rolesSchema } from "@/server/validation";

/** Settings → "I rent machines" / "I list machines". Never grants admin. */
export const PUT = route(async (req) => {
  const u = await requireUser(req);
  return Response.json(await setMyRoles(u, parse(rolesSchema, await readJson(req))));
});
