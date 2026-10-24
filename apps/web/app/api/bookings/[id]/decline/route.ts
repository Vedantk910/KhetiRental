import { declineBooking } from "@/server/bookings";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { declineSchema } from "@/server/validation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const { reason } = parse(declineSchema, await readJson(req));
  return Response.json(await declineBooking(u, uuidParam(id), reason));
});
