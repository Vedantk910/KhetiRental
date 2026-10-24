import { createBooking } from "@/lib/marketplace-bookings";
import { json, readJson } from "@/lib/marketplace-http";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    return json(createBooking(req.headers.get("Idempotency-Key"), body));
  } catch {
    return Response.json({ code: "internal", message: "Something went wrong. Try again." }, { status: 500 });
  }
}
