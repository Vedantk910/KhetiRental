import { requireAdmin, searchUsers } from "@/server/admin";
import { parse, queryOf, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { userSearchSchema } from "@/server/validation";

export const GET = route(async (req) => {
  const u = await requireUser(req);
  requireAdmin(u);
  return Response.json(await searchUsers(u, parse(userSearchSchema, queryOf(req)).q));
});
