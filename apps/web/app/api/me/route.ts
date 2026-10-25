import { route } from "@/server/http";
import { requireUser } from "@/server/session";

/** Who is signed in, for the header and tab bar (they show the Owner tab only to owners). */
export const GET = route(async (req) => {
  const u = await requireUser(req);
  return Response.json({ id: u.id, name: u.name, roles: u.roles });
});
