// Server-side listing drafts (UI-SPEC §4.11): one per owner, restored on any device. The text fields come from
// the wizard; photos only ever arrive through setDraftPhoto, so a draft can never point at someone else's file.
import { getSql, one } from "./db";
import { ApiError } from "./http";
import { limit } from "./rate-limit";
import { requireRole, type SessionUser } from "./session";
import { removeUpload, saveImage } from "./uploads";
import type { PhotoKey } from "@/lib/domain";

const MAX_PHOTOS = 8;

export async function getDraft(u: SessionUser) {
  requireRole(u, "owner");
  const d = one(
    await getSql()<{ step: number; data: unknown; photos: Record<string, string>; updatedAt: Date }[]>`
    SELECT step, data, photos, updated_at AS "updatedAt" FROM listing_drafts WHERE owner_id = ${u.id}`,
  );
  return d ?? null;
}

export async function saveDraft(u: SessionUser, input: { step: number; data: Record<string, unknown> }) {
  requireRole(u, "owner");
  await limit("draftSave", u.id);
  const sql = getSql();
  await sql`
    INSERT INTO listing_drafts (owner_id, step, data) VALUES (${u.id}, ${input.step}, ${JSON.stringify(input.data)}::jsonb)
    ON CONFLICT (owner_id) DO UPDATE SET step = EXCLUDED.step, data = EXCLUDED.data, updated_at = now()`;
}

/** Removes the draft and the files nothing else points at. Safe to call when there is none. */
export async function deleteDraft(ownerId: string) {
  const row = one(
    await getSql()<
      { photos: Record<string, string> }[]
    >`DELETE FROM listing_drafts WHERE owner_id = ${ownerId} RETURNING photos`,
  );
  await Promise.all(Object.values(row?.photos ?? {}).map(removeUpload));
}

export async function setDraftPhoto(u: SessionUser, key: PhotoKey, file: unknown) {
  requireRole(u, "owner");
  await limit("upload", u.id);
  const url = await saveImage(file);
  const sql = getSql();
  const old = await sql.begin(async (tx) => {
    const prev = one(
      await tx<
        { url: string | null }[]
      >`SELECT photos ->> ${key} AS url FROM listing_drafts WHERE owner_id = ${u.id} FOR UPDATE`,
    );
    await tx`
      INSERT INTO listing_drafts (owner_id, photos) VALUES (${u.id}, jsonb_build_object(${key}::text, ${url}::text))
      ON CONFLICT (owner_id) DO UPDATE
        SET photos = listing_drafts.photos || jsonb_build_object(${key}::text, ${url}::text), updated_at = now()`;
    return prev?.url ?? null;
  });
  if (old) await removeUpload(old);
  return { url };
}

export async function removeDraftPhoto(u: SessionUser, key: PhotoKey) {
  requireRole(u, "owner");
  const sql = getSql();
  const url = await sql.begin(async (tx) => {
    const prev = one(
      await tx<
        { url: string | null }[]
      >`SELECT photos ->> ${key} AS url FROM listing_drafts WHERE owner_id = ${u.id} FOR UPDATE`,
    );
    if (prev?.url)
      await tx`UPDATE listing_drafts SET photos = photos - ${key}::text, updated_at = now() WHERE owner_id = ${u.id}`;
    return prev?.url ?? null;
  });
  if (url) await removeUpload(url);
}

/** Publish: hands one draft photo to a machine of the same owner. The file stays; the draft forgets it. */
export async function attachDraftPhoto(u: SessionUser, machineId: string, key: PhotoKey) {
  requireRole(u, "owner");
  const kind = key.startsWith("extra") ? "extra" : key;
  return getSql().begin(async (tx) => {
    // The machine row lock serialises racing attaches, so the photo limit holds.
    const m = one(await tx`SELECT 1 FROM machines WHERE id = ${machineId} AND owner_id = ${u.id} FOR UPDATE`);
    if (!m) throw new ApiError(404, "not_found");
    const d = one(
      await tx<
        { url: string | null }[]
      >`SELECT photos ->> ${key} AS url FROM listing_drafts WHERE owner_id = ${u.id} FOR UPDATE`,
    );
    if (!d?.url) throw new ApiError(404, "not_found");
    const [{ n }] = await tx<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM machine_photos WHERE machine_id = ${machineId}`;
    if (n >= MAX_PHOTOS) throw new ApiError(409, "too_many_photos");
    // One RC at a time, as for a direct upload: the new one replaces the old and goes back to review.
    if (kind === "rc") await tx`DELETE FROM machine_photos WHERE machine_id = ${machineId} AND kind = 'rc'`;
    const [p] = await tx<{ id: string; url: string; kind: string }[]>`
      INSERT INTO machine_photos (machine_id, url, kind, sort) VALUES (${machineId}, ${d.url}, ${kind}, ${n})
      RETURNING id, url, kind`;
    if (kind === "rc") await tx`UPDATE machines SET rc_status = 'pending' WHERE id = ${machineId}`;
    await tx`UPDATE listing_drafts SET photos = photos - ${key}::text, updated_at = now() WHERE owner_id = ${u.id}`;
    return p;
  });
}
