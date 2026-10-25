// M2 wiring end to end against the production build: Auth.js sign-in (Mock Google, password, phone OTP),
// database sessions, login gating in middleware, and the booking API with a real session.
import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { E2E_AUTH_SECRET, E2E_DATABASE_URL } from "./db";

async function signIn(request: APIRequestContext, provider: string, fields: Record<string, string>) {
  const { csrfToken } = (await (await request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  return request.post(`/api/auth/callback/${provider}`, {
    form: { csrfToken, callbackUrl: "/en/rent", ...fields },
    maxRedirects: 0,
  });
}
const session = async (request: APIRequestContext) =>
  (await (await request.get("/api/auth/session")).json()) as {
    user?: { name: string; roles: string[] };
  } | null;

test("logged-out visitors are sent to login with ?next", async ({ request }) => {
  const r = await request.get("/en/bookings?tab=past", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers().location).toMatch(/\/en\/login\?next=%2Fen%2Fbookings%3Ftab%3Dpast$/);
  expect((await request.get("/api/bookings")).status()).toBe(401);
});

test("Mock Google signs in the demo user with an httpOnly session; sign-out ends it", async ({ request }) => {
  const r = await signIn(request, "mock-google", {});
  expect(r.status()).toBe(302);
  const cookie = r
    .headersArray()
    .find((h) => h.name.toLowerCase() === "set-cookie" && h.value.includes("session-token"));
  expect(cookie?.value).toMatch(/HttpOnly/i);
  expect(cookie?.value).toMatch(/SameSite=Lax/i);
  expect((await session(request))?.user).toMatchObject({ name: "Demo Google User", roles: ["renter"] });
  // gated pages now pass the middleware (the pages themselves arrive in M3)
  const page = await request.get("/en/rent", { maxRedirects: 0 });
  expect(page.headers()).not.toHaveProperty("location", expect.stringContaining("/login"));
  // renters can't open owner pages
  expect((await request.get("/en/owner", { maxRedirects: 0 })).status()).toBe(403);

  const { csrfToken } = (await (await request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await request.post("/api/auth/signout", { form: { csrfToken }, maxRedirects: 0 });
  expect((await session(request))?.user).toBeUndefined();
  expect((await request.get("/api/bookings")).status()).toBe(401);
});

test("email + password: wrong password is a generic error; right one signs in the seeded owner", async ({
  request,
}) => {
  const bad = await signIn(request, "password", {
    email: "ramesh@khetirental.test",
    password: "wrong-password",
  });
  expect(bad.headers().location).toContain("error=CredentialsSignin");
  const ok = await signIn(request, "password", {
    email: "ramesh@khetirental.test",
    password: "kheti-demo-2026",
  });
  expect(ok.headers().location).toContain("/en/rent");
  expect((await session(request))?.user?.roles).toEqual(["owner"]);
  expect((await request.get("/en/owner", { maxRedirects: 0 })).status()).not.toBe(403);
});

test("phone OTP: wrong code reports tries left; the right code signs up a new user", async ({ request }) => {
  const phone = `+9197${String(Date.now()).slice(-8)}`;
  expect((await request.post("/api/auth/otp", { data: { phone } })).status()).toBe(200);
  expect((await (await request.post("/api/auth/otp", { data: { phone } })).json()).code).toBe(
    "otp_resend_wait",
  );
  // The code itself is only in the server log; plant a known one the way sendOtp stores it.
  const sql = postgres(E2E_DATABASE_URL, { max: 1 });
  const hash = createHmac("sha256", E2E_AUTH_SECRET).update(`${phone}:424242`).digest("hex");
  await sql`UPDATE otp_codes SET code_hash = ${hash} WHERE phone = ${phone}`;
  await sql.end();
  const wrong = await signIn(request, "phone-otp", {
    phone,
    code: "000000",
    name: "Kisan Test",
    roles: "renter",
  });
  expect(wrong.headers().location).toContain("code=otp_wrong_4");
  const ok = await signIn(request, "phone-otp", {
    phone,
    code: "424242",
    name: "Kisan Test",
    roles: "renter,owner",
  });
  expect(ok.headers().location).toContain("/en/rent");
  expect((await session(request))?.user).toMatchObject({ name: "Kisan Test", roles: ["renter", "owner"] });
});

test("search → book → replay → pay later, with the session from Mock Google", async ({ request }) => {
  await signIn(request, "mock-google", {});
  const found = await request.get("/api/machines?pin=413512&radius=25&sort=nearest");
  expect(found.status()).toBe(200);
  const body = (await found.json()) as {
    items: { id: string; isSample: boolean; distanceKm: number }[];
    total: number;
  };
  expect(body.total).toBeGreaterThan(0);
  expect(body.items.every((i) => i.isSample)).toBe(true);
  const day = new Date(Date.now() + 5.5 * 3600_000 + 60 * 86_400_000).toISOString().slice(0, 10);
  const key = crypto.randomUUID();
  const make = () =>
    request.post("/api/bookings", {
      data: { machineId: body.items[0].id, startDate: day, endDate: day, slot: "full" },
      headers: { "idempotency-key": key },
    });
  const a = await make();
  expect(a.status()).toBe(201);
  const b = await make();
  expect(b.status()).toBe(200);
  const booking = (await a.json()) as { id: string; totalPaise: number; code: string };
  expect(((await b.json()) as { id: string }).id).toBe(booking.id);
  const pay = await request.post(`/api/bookings/${booking.id}/pay`, {
    data: { method: "cash", amountPaise: booking.totalPaise },
  });
  expect(((await pay.json()) as { status: string }).status).toBe("pay_later");
});
