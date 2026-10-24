import { route } from "@/server/http";
import { listNotifications } from "@/server/notifications";
import { requireUser } from "@/server/session";

export const GET = route(async (req) => Response.json(await listNotifications(await requireUser(req))));
