import { attachDraftPhoto } from "@/server/drafts";
import { addPhoto } from "@/server/machines";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { limit } from "@/server/rate-limit";
import { requireUser } from "@/server/session";
import { MAX_UPLOAD_BYTES, readForm } from "@/server/uploads";
import { draftAttachSchema, photoKindSchema } from "@/server/validation";

/**
 * multipart/form-data: photo (jpeg/png/webp ≤ 5 MB), kind. Or JSON { fromDraft: key }: publish moves a photo
 * already uploaded to the owner's draft onto this machine.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  if (req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    const { fromDraft } = parse(draftAttachSchema, await readJson(req));
    return Response.json(await attachDraftPhoto(u, uuidParam(id), fromDraft), { status: 201 });
  }
  await limit("upload", u.id);
  const form = await readForm(req, MAX_UPLOAD_BYTES + 64_000);
  const kind = parse(photoKindSchema, form.get("kind") ?? "extra");
  return Response.json(await addPhoto(u, uuidParam(id), form.get("photo"), kind), { status: 201 });
});
