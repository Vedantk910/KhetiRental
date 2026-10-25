import { parse, queryOf, route, uuidParam } from "@/server/http";
import { machineReviews } from "@/server/machines";
import { requireUser } from "@/server/session";
import { cursorSchema } from "@/server/validation";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const { cursor } = parse(cursorSchema, queryOf(req));
  return Response.json(await machineReviews(u, uuidParam(id), Number(cursor ?? 0)));
});
