import { deleteDraft, getDraft, saveDraft } from "@/server/drafts";
import { parse, readJson, route } from "@/server/http";
import { requireRole, requireUser } from "@/server/session";
import { draftSaveSchema } from "@/server/validation";

/** The signed-in owner's listing draft (UI-SPEC §4.11), or { draft: null }. */
export const GET = route(async (req) => {
  const u = await requireUser(req);
  return Response.json({ draft: await getDraft(u) });
});

export const PUT = route(async (req) => {
  const u = await requireUser(req);
  await saveDraft(u, parse(draftSaveSchema, await readJson(req)));
  return Response.json({ ok: true });
});

export const DELETE = route(async (req) => {
  const u = await requireUser(req);
  requireRole(u, "owner");
  await deleteDraft(u.id);
  return Response.json({ ok: true });
});
