import { route, parse, queryOf } from "@/server/http";
import { searchMachines } from "@/server/machines";
import { requireUser } from "@/server/session";
import { searchSchema } from "@/server/validation";

export const GET = route(async (req) => {
  await requireUser(req);
  return Response.json(await searchMachines(parse(searchSchema, queryOf(req))));
});
