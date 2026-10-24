import { deletePhoto } from "@/server/machines";
import { route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";

export const DELETE = route<{ id: string; photoId: string }>(async (req, { id, photoId }) => {
  const u = await requireUser(req);
  await deletePhoto(u, uuidParam(id), uuidParam(photoId));
  return new Response(null, { status: 204 });
});
