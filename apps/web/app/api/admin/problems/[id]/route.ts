import { requireAdmin, reviewProblem } from "@/server/admin";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { problemReviewSchema } from "@/server/validation";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  requireAdmin(u);
  return Response.json(
    await reviewProblem(u, uuidParam(id), parse(problemReviewSchema, await readJson(req))),
  );
});
