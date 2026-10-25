import { route, parse, queryOf } from "@/server/http";
import { nearestPlace, suggestPlaces } from "@/server/places";
import { requireUser } from "@/server/session";
import { placesSchema } from "@/server/validation";

export const GET = route(async (req) => {
  await requireUser(req);
  const q = parse(placesSchema, queryOf(req));
  if ("q" in q) return Response.json({ items: await suggestPlaces(q.q) });
  return Response.json({ item: await nearestPlace(q.lat, q.lng) });
});
