// One error shape for every route (C-04): { code, message, field? }, where message is the i18n key
// the client renders. Route handlers stay thin: parse → call server/* → respond.
import { ZodError, type ZodType } from "zod";

export const API_ERRORS = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_request",
  "invalid_json",
  "cross_origin",
  "rate_limited",
  "machine_unavailable",
  "past_date",
  "own_machine",
  "idempotency_conflict",
  "invalid_state",
  "reply_window_closed",
  "amount_mismatch",
  "already_paid",
  "payment_failed",
  "place_not_found",
  "otp_wrong",
  "otp_expired",
  "otp_locked",
  "otp_resend_wait",
  "email_taken",
  "token_invalid",
  "has_bookings",
  "active_bookings",
  "phone_taken",
  "day_booked",
  "file_too_large",
  "file_type",
  "too_many_photos",
  "internal",
] as const;
export type ApiErrorCode = (typeof API_ERRORS)[number];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly field?: string,
    readonly headers?: Record<string, string>,
    readonly details?: Record<string, number | string>,
  ) {
    super(code);
  }
}

export const errorBody = (code: ApiErrorCode, field?: string, details?: Record<string, number | string>) => ({
  code,
  message: `errors.api.${code}`,
  ...(field ? { field } : {}),
  ...details,
});

const fail = (
  status: number,
  code: ApiErrorCode,
  field?: string,
  headers?: Record<string, string>,
  details?: Record<string, number | string>,
) => Response.json(errorBody(code, field, details), { status, headers });

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, "invalid_request", r.error.issues[0]?.path.join(".") || undefined);
  return r.data;
}

const MAX_JSON = 16_384;

/** Bounded JSON body; anything else is a 400. */
export async function readJson(req: Request): Promise<unknown> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new ApiError(400, "invalid_json");
  const text = await req.text();
  if (text.length > MAX_JSON) throw new ApiError(400, "invalid_json");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}

export const queryOf = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);

/** Writes from another site are refused even before the sameSite=lax cookie would be. */
function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "cross_origin");
  }
  if (originHost !== host) throw new ApiError(403, "cross_origin");
}

type Ctx<P> = { params: Promise<P> };

export function route<P = Record<string, never>>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      checkOrigin(req);
      return await fn(req, await ctx.params);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.field, e.headers, e.details);
      if (e instanceof ZodError) return fail(400, "invalid_request", e.issues[0]?.path.join("."));
      console.error("[api] unhandled", e);
      return fail(500, "internal");
    }
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Path ids that aren't UUIDs are simply not found (no 500 from a cast error). */
export function uuidParam(id: string): string {
  if (!UUID.test(id)) throw new ApiError(404, "not_found");
  return id.toLowerCase();
}
