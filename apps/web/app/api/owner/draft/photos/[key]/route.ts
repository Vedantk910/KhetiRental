import { parse, route } from "@/server/http";
import { removeDraftPhoto } from "@/server/drafts";
import { requireUser } from "@/server/session";
import { draftPhotoKeySchema } from "@/server/validation";

export const DELETE = route<{ key: string }>(async (req, { key }) => {
  const u = await requireUser(req);
  await removeDraftPhoto(u, parse(draftPhotoKeySchema, key));
  return Response.json({ ok: true });
});
