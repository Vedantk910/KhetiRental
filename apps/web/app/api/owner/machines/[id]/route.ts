import { deleteMachine, updateMachine } from "@/server/machines";
import { parse, readJson, route, uuidParam } from "@/server/http";
import { requireUser } from "@/server/session";
import { machinePatchSchema } from "@/server/validation";

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  return Response.json(await updateMachine(u, uuidParam(id), parse(machinePatchSchema, await readJson(req))));
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const u = await requireUser(req);
  await deleteMachine(u, uuidParam(id));
  return new Response(null, { status: 204 });
});
