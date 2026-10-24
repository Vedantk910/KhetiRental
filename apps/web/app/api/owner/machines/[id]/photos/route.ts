import { addPhoto } from "@/server/machines";
import { parse, route, uuidParam } from "@/server/http";
import { limit } from "@/server/rate-limit";
import { requireUser } from "@/server/session";
import { MAX_UPLOAD_BYTES, readForm } from "@/server/uploads";
import { photoKindSchema } from "@/server/validation";

/** multipart/form-data: photo (jpeg/png/webp ≤ 5 MB), kind. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  await limit("upload", u.id);
  const form = await readForm(req, MAX_UPLOAD_BYTES + 64_000);
  const kind = parse(photoKindSchema, form.get("kind") ?? "extra");
  return Response.json(await addPhoto(u, uuidParam(id), form.get("photo"), kind), { status: 201 });
});
