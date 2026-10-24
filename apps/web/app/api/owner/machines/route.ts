import { createMachine, listMyMachines } from "@/server/machines";
import { parse, readJson, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { machineCreateSchema } from "@/server/validation";

export const GET = route(async (req) => {
  const u = await requireUser(req);
  return Response.json({ items: await listMyMachines(u) });
});

export const POST = route(async (req) => {
  const u = await requireUser(req);
  return Response.json(await createMachine(u, parse(machineCreateSchema, await readJson(req))), {
    status: 201,
  });
});
