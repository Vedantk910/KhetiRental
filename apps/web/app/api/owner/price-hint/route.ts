import { parse, queryOf, route } from "@/server/http";
import { priceHint } from "@/server/owner";
import { requireUser } from "@/server/session";
import { priceHintSchema } from "@/server/validation";

export const GET = route(async (req) => {
  const u = await requireUser(req);
  return Response.json(await priceHint(u, parse(priceHintSchema, queryOf(req))));
});
