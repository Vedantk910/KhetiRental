import { settleBooking } from "@/lib/marketplace-bookings";
import { json } from "@/lib/marketplace-http";
import { errorBody } from "@/server/http";
import { currentUser } from "@/server/session";

/** S-03: settling moves money, so only an admin session may call it, and every call is logged. */
export async function POST(req: Request, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    const user = await currentUser(req);
    if (!user) return Response.json(errorBody("unauthorized"), { status: 401 });
    if (!user.roles.includes("admin")) return Response.json(errorBody("forbidden"), { status: 403 });
    const { booking_id } = await ctx.params;
    const res = settleBooking(booking_id, req.headers.get("Idempotency-Key"));
    console.info(`[audit] settle booking=${booking_id} by admin=${user.id} status=${res.status}`);
    return json(res);
  } catch {
    return Response.json(errorBody("internal"), { status: 500 });
  }
}
