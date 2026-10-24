import { createBooking, listBookings } from "@/server/bookings";
import { ApiError, parse, readJson, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { bookingCreateSchema, idempotencyKeySchema } from "@/server/validation";

export const GET = route(async (req) => {
  const u = await requireUser(req);
  return Response.json({ items: await listBookings(u) });
});

/** The renter comes from the session, never the body (S-02). Replays with the same Idempotency-Key return the same booking. */
export const POST = route(async (req) => {
  const u = await requireUser(req);
  const key = idempotencyKeySchema.safeParse(req.headers.get("idempotency-key"));
  if (!key.success) throw new ApiError(400, "invalid_request", "Idempotency-Key");
  const input = parse(bookingCreateSchema, await readJson(req));
  const { booking, replayed } = await createBooking(u, input, key.data);
  return Response.json(booking, { status: replayed ? 200 : 201 });
});
