import { setBlocks } from "@/server/machines";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { blocksSchema } from "@/server/validation";

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  const { days, blocked } = parse(blocksSchema, await readJson(req));
  return Response.json(await setBlocks(u, uuidParam(id), days, blocked));
});
