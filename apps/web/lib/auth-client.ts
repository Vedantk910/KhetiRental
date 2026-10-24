// The browser half of Auth.js sign-in: the same CSRF + callback POST that next-auth/react makes, without the library.
export interface SignInResult {
  ok: boolean;
  /** Auth.js error code, e.g. "credentials", "rate_limited", "otp_wrong_3". */
  code?: string;
  url?: string;
}

async function post(provider: string, fields: Record<string, string>, path: "callback" | "signin") {
  const { csrfToken } = (await (await fetch("/api/auth/csrf")).json()) as { csrfToken: string };
  const res = await fetch(`/api/auth/${path}/${provider}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1" },
    body: new URLSearchParams({ ...fields, csrfToken, callbackUrl: location.origin }),
  });
  return (await res.json()) as { url?: string };
}

/** Credentials-style providers ("password", "phone-otp", "mock-google"). Throws on a network failure. */
export async function signInWith(
  provider: string,
  fields: Record<string, string> = {},
): Promise<SignInResult> {
  const { url } = await post(provider, fields, "callback");
  if (!url) return { ok: false, code: "credentials" };
  const u = new URL(url, location.origin);
  const error = u.searchParams.get("error");
  return error ? { ok: false, code: u.searchParams.get("code") ?? "credentials", url } : { ok: true, url };
}

/** Real Google: Auth.js answers with the accounts.google.com URL and the browser leaves. */
export async function startOAuth(provider: string, callbackUrl: string) {
  const { csrfToken } = (await (await fetch("/api/auth/csrf")).json()) as { csrfToken: string };
  const res = await fetch(`/api/auth/signin/${provider}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1" },
    body: new URLSearchParams({ csrfToken, callbackUrl }),
  });
  const { url } = (await res.json()) as { url?: string };
  if (url) location.assign(url);
}

export async function sessionRoles(): Promise<string[]> {
  const s = (await (await fetch("/api/auth/session")).json()) as { user?: { roles?: string[] } } | null;
  return s?.user?.roles ?? [];
}
