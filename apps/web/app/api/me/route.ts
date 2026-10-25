import { deleteAccount, updateName } from "@/server/account";
import { parse, readJson, route } from "@/server/http";
import { requireUser } from "@/server/session";
import { deleteAccountSchema, profileSchema } from "@/server/validation";

/** Who is signed in, for the header and tab bar (they show the Owner tab only to owners). */
export const GET = route(async (req) => {
  const u = await requireUser(req);
  return Response.json({ id: u.id, name: u.name, roles: u.roles });
});

export const PATCH = route(async (req) => {
  const u = await requireUser(req);
  return Response.json(await updateName(u, parse(profileSchema, await readJson(req)).name));
});

const CLEAR = ["__Secure-authjs.session-token", "authjs.session-token"];

/** Delete my account (UI-SPEC §4.15): the body must be exactly {"confirm":"DELETE"}. */
export const DELETE = route(async (req) => {
  const u = await requireUser(req);
  parse(deleteAccountSchema, await readJson(req));
  await deleteAccount(u);
  const res = Response.json({ ok: true });
  for (const name of CLEAR)
    res.headers.append("set-cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
});
