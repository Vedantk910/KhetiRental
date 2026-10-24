import { readJson, route } from "@/server/http";
import { signup } from "@/server/passwords";
import { clientIp, limit } from "@/server/rate-limit";

/** Creates the account; the client then signs in with Auth.js (provider "password"). */
export const POST = route(async (req) => {
  await limit("signupIp", clientIp(req));
  const u = await signup(await readJson(req));
  return Response.json({ id: u.id, roles: u.roles }, { status: 201 });
});
