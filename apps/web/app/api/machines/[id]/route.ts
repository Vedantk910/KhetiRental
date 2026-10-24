import { route, uuidParam } from "@/server/http";
import { machineDetail } from "@/server/machines";
import { requireUser } from "@/server/session";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  return Response.json(await machineDetail(u, uuidParam(id)));
});
