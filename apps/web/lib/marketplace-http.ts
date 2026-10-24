import type { Result } from "./marketplace-bookings";

const MAX_BODY = 8192;

export const json = (r: Result) => Response.json(r.body, { status: r.status });

/** Parses a bounded JSON body; returns undefined when it is not valid JSON or too large (the handler turns that into a 400). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    const t = await req.text();
    return t.length > MAX_BODY ? undefined : JSON.parse(t);
  } catch {
    return undefined;
  }
}
