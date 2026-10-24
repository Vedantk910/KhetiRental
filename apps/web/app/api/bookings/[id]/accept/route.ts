import { acceptBooking } from "@/server/bookings";
import { route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  return Response.json(await acceptBooking(u, uuidParam(id)));
});
