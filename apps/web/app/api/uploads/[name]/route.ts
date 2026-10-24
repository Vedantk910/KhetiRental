import { route } from "@/server/http";
import { requireUser } from "@/server/session";
import { readUpload } from "@/server/uploads";

export const GET = route<{ name: string }>(async (req, { name }) => {
  await requireUser(req);
  const f = await readUpload(name);
  return new Response(new Uint8Array(f.bytes), {
    headers: {
      "content-type": f.type,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
});
