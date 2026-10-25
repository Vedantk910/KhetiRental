import { parse, queryOf, route, uuidParam } from "@/server/http";
import { ownerCalendar } from "@/server/owner";
import { requireUser } from "@/server/session";
import { monthSchema } from "@/server/validation";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const month = parse(monthSchema, queryOf(req).month);
  return Response.json({ month, days: await ownerCalendar(u, uuidParam(id), month) });
});
