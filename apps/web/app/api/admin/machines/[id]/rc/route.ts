import { requireAdmin, reviewRc } from "@/server/admin";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { rcDecisionSchema } from "@/server/validation";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  requireAdmin(u);
  const { decision } = parse(rcDecisionSchema, await readJson(req));
  return Response.json(await reviewRc(u, uuidParam(id), decision));
});
