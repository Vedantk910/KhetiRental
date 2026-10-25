// Problem reports (UI-SPEC §4.10): renter or owner of the booking, up to 3 photos.
import { PROBLEM_TYPES } from "@/lib/domain";
import { bookingParty } from "./bookings";
import { getSql } from "./db";
import { ApiError, parse } from "./http";
import { limit } from "./rate-limit";
import type { SessionUser } from "./session";
import { saveImage } from "./uploads";
import { problemFieldsSchema } from "./validation";

const MAX_PROBLEM_PHOTOS = 3;

export async function reportProblem(
  u: SessionUser,
  bookingId: string,
  form: { type: unknown; text?: unknown; photos: unknown[] },
) {
  const { role, booking } = await bookingParty(u, bookingId);
  await limit("problemReport", u.id);
  const { type, text } = parse(problemFieldsSchema, { type: form.type, text: form.text || undefined });
  if (!(PROBLEM_TYPES[role] as readonly string[]).includes(type))
    throw new ApiError(400, "invalid_request", "type");
  if (form.photos.length > MAX_PROBLEM_PHOTOS) throw new ApiError(400, "too_many_photos", "photos");
  const photos: string[] = [];
  for (const f of form.photos) photos.push(await saveImage(f));
  const [r] = await getSql()<{ id: string }[]>`
    INSERT INTO problem_reports (booking_id, reporter_id, type, text, photos)
    VALUES (${booking.id}, ${u.id}, ${type}, ${text ?? null}, ${photos}) RETURNING id`;
  return { id: r.id, type, photos };
}
