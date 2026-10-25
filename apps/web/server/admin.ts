// Demo admin (UI-SPEC §4.20): RC reviews, problem reports, users. Admin role only, checked here every time.
import { getSql, one } from "./db";
import { ApiError } from "./http";
import type { SessionUser } from "./session";

export function requireAdmin(u: SessionUser) {
  if (!u.roles.includes("admin")) throw new ApiError(403, "forbidden");
}

export async function adminOverview(u: SessionUser) {
  requireAdmin(u);
  const sql = getSql();
  const rc = await sql<
    { machineId: string; name: string; owner: string | null; rcUrl: string; createdAt: string }[]
  >`
    SELECT m.id AS "machineId", m.make || ' ' || m.model AS name, o.name AS owner,
      p.url AS "rcUrl", p.created_at AS "createdAt"
    FROM machines m JOIN users o ON o.id = m.owner_id
    JOIN LATERAL (SELECT url, created_at FROM machine_photos WHERE machine_id = m.id AND kind = 'rc'
                  ORDER BY created_at DESC LIMIT 1) p ON true
    WHERE m.rc_status = 'pending' ORDER BY p.created_at LIMIT 100`;
  const problems = await sql<
    {
      id: string;
      code: string;
      type: string;
      text: string | null;
      photos: string[];
      status: string;
      note: string | null;
      reporter: string | null;
      createdAt: string;
    }[]
  >`
    SELECT r.id, b.code, r.type, r.text, r.photos, r.status, r.note, u.name AS reporter, r.created_at AS "createdAt"
    FROM problem_reports r JOIN bookings b ON b.id = r.booking_id JOIN users u ON u.id = r.reporter_id
    ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 100`;
  return { rc, problems };
}

export async function reviewRc(u: SessionUser, machineId: string, decision: "checked" | "rejected") {
  requireAdmin(u);
  const sql = getSql();
  const rows =
    await sql`UPDATE machines SET rc_status = ${decision} WHERE id = ${machineId} AND rc_status <> 'none' RETURNING id`;
  if (rows.length === 0) {
    const exists = one(await sql`SELECT 1 FROM machines WHERE id = ${machineId}`);
    throw new ApiError(exists ? 409 : 404, exists ? "invalid_state" : "not_found");
  }
  return { machineId, rcStatus: decision };
}

export async function reviewProblem(
  u: SessionUser,
  id: string,
  p: { status: "open" | "resolved"; note?: string },
) {
  requireAdmin(u);
  const sql = getSql();
  const rows = await sql`
    UPDATE problem_reports SET status = ${p.status}${p.note === undefined ? sql`` : sql`, note = ${p.note || null}`}
    WHERE id = ${id} RETURNING id`;
  if (rows.length === 0) throw new ApiError(404, "not_found");
  return { id, status: p.status };
}

export async function searchUsers(u: SessionUser, q: string) {
  requireAdmin(u);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const items = await getSql()<
    { id: string; name: string | null; email: string | null; phone: string | null; roles: string[] }[]
  >`
    SELECT id, name, email, phone, roles FROM users
    WHERE deleted_at IS NULL AND (${q} = '' OR name ILIKE ${like} OR email ILIKE ${like} OR phone ILIKE ${like})
    ORDER BY created_at DESC, id LIMIT 20`;
  return { items };
}

export async function setUserRoles(u: SessionUser, id: string, roles: string[]) {
  requireAdmin(u);
  // An admin can't lock themselves out of the admin page.
  if (id === u.id && !roles.includes("admin")) throw new ApiError(409, "invalid_state");
  const rows = await getSql()<
    { roles: string[] }[]
  >`UPDATE users SET roles = ${roles} WHERE id = ${id} AND deleted_at IS NULL RETURNING roles`;
  const r = one(rows);
  if (!r) throw new ApiError(404, "not_found");
  return { id, roles: r.roles };
}
