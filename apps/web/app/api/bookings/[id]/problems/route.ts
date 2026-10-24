import { route, uuidParam } from "@/server/http";
import { reportProblem } from "@/server/problems";
import { requireUser } from "@/server/session";
import { MAX_UPLOAD_BYTES, readForm } from "@/server/uploads";

/** multipart/form-data: type, text?, photos (0–3 images). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const form = await readForm(req, 3 * MAX_UPLOAD_BYTES + 64_000);
  const report = await reportProblem(u, uuidParam(id), {
    type: form.get("type"),
    text: form.get("text") ?? undefined,
    photos: form.getAll("photos"),
  });
  return Response.json(report, { status: 201 });
});
