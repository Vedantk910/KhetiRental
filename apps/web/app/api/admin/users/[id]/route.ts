import { requireAdmin, setUserRoles } from "@/server/admin";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { userRolesSchema } from "@/server/validation";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  requireAdmin(u);
  const { roles } = parse(userRolesSchema, await readJson(req));
  return Response.json(await setUserRoles(u, uuidParam(id), roles));
});
