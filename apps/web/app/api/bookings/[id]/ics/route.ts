import { bookingIcs } from "@/server/bookings";
import { route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const { code, body } = await bookingIcs(u, uuidParam(id));
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${code}.ics"`,
      "cache-control": "private, no-store",
    },
  });
});
