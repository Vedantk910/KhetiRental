import { parse, route } from "@/server/http";
import { setDraftPhoto } from "@/server/drafts";
import { requireUser } from "@/server/session";
import { MAX_UPLOAD_BYTES, readForm } from "@/server/uploads";
import { draftPhotoKeySchema } from "@/server/validation";

/** multipart/form-data: photo (jpeg/png/webp ≤ 5 MB), key (front, side, meter, extra1–3, rc). */
export const POST = route(async (req) => {
  const u = await requireUser(req);
  const form = await readForm(req, MAX_UPLOAD_BYTES + 64_000);
  const key = parse(draftPhotoKeySchema, form.get("key"));
  return Response.json(await setDraftPhoto(u, key, form.get("photo")), { status: 201 });
});
