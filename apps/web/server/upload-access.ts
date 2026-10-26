// Who may open an uploaded file. Names are unguessable, but an RC or a problem photo is private anyway.
import { getSql, one } from "./db";
import type { SessionUser } from "./session";

/** Machine photos: any signed-in user. RC: its owner and admins. Draft photos: the owner. Problem photos: the booking's two sides and admins. Strays: nobody. */
export async function canReadUpload(u: SessionUser, name: string): Promise<boolean> {
  const url = `/api/uploads/${name}`;
  const sql = getSql();
  const admin = u.roles.includes("admin");
  const photo = one(
    await sql<{ kind: string; owner_id: string }[]>`
    SELECT p.kind, m.owner_id FROM machine_photos p JOIN machines m ON m.id = p.machine_id WHERE p.url = ${url} LIMIT 1`,
  );
  if (photo) return photo.kind !== "rc" || admin || photo.owner_id === u.id;
  // A photo still in the draft belongs to the owner who uploaded it, nobody else.
  const draft = one(
    await sql`SELECT 1 FROM listing_drafts d, jsonb_each_text(d.photos) e WHERE d.owner_id = ${u.id} AND e.value = ${url} LIMIT 1`,
  );
  if (draft) return true;
  const report = one(
    await sql<{ renter_id: string; owner_id: string }[]>`
    SELECT b.renter_id, m.owner_id FROM problem_reports r
    JOIN bookings b ON b.id = r.booking_id JOIN machines m ON m.id = b.machine_id
    WHERE ${url} = ANY(r.photos) LIMIT 1`,
  );
  return !!report && (admin || report.renter_id === u.id || report.owner_id === u.id);
}
