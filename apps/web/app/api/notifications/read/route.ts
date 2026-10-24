import { parse, readJson, route } from "@/server/http";
import { markRead } from "@/server/notifications";
import { requireUser } from "@/server/session";
import { markReadSchema } from "@/server/validation";

export const POST = route(async (req) => {
  const u = await requireUser(req);
  return Response.json(await markRead(u, parse(markReadSchema, await readJson(req))));
});
