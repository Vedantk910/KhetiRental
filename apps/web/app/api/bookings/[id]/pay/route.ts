import { payBooking } from "@/server/bookings";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { paySchema } from "@/server/validation";

/** D-08: only {method, amountPaise}; card fields are never sent here (the strict schema rejects them). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  return Response.json(await payBooking(u, uuidParam(id), parse(paySchema, await readJson(req))));
});
