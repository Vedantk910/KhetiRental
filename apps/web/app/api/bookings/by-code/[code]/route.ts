import { getBookingByCode } from "@/server/bookings";
import { route } from "@/server/http";
import { requireUser } from "@/server/session";

export const GET = route<{ code: string }>(async (req, { code }) => {
  const u = await requireUser(req);
  return Response.json(await getBookingByCode(u, code));
});
