import { ApiError, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { canReadUpload } from "@/server/upload-access";
import { readUpload } from "@/server/uploads";

export const GET = route<{ name: string }>(async (req, { name }) => {
  const u = await requireUser(req);
  if (!(await canReadUpload(u, name))) throw new ApiError(404, "not_found");
  const f = await readUpload(name);
  return new Response(new Uint8Array(f.bytes), {
    headers: {
      "content-type": f.type,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
});
