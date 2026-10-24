import { settleBooking } from "@/lib/marketplace-bookings";
import { json } from "@/lib/marketplace-http";

export async function POST(req: Request, ctx: { params: Promise<{ booking_id: string }> }) {
  try {
    const { booking_id } = await ctx.params;
    return json(settleBooking(booking_id, req.headers.get("Idempotency-Key")));
  } catch {
    return Response.json({ code: "internal", message: "Something went wrong. Try again." }, { status: 500 });
  }
}
