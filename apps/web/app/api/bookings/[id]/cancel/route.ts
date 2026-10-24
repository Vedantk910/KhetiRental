import { cancelBooking } from "@/server/bookings";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { cancelSchema } from "@/server/validation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const { reason } = parse(cancelSchema, await readJson(req));
  return Response.json(await cancelBooking(u, uuidParam(id), reason));
});
