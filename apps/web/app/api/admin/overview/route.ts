import { adminOverview } from "@/server/admin";
import { route } from "@/server/http";
import { requireUser } from "@/server/session";

export const GET = route(async (req) => Response.json(await adminOverview(await requireUser(req))));
