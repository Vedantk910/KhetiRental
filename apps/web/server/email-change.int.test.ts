// @vitest-environment node
// Settings → change email. Adversarial: other users, replay, parallel confirms, expiry, address races,
// hijacked sessions (password required), mail bombing, hostile input.
import { POST as confirmRoute } from "@/app/api/me/email/confirm/route";
import { POST as requestRoute } from "@/app/api/me/email/route";
import { getSql } from "./db";
import { lastMail } from "./mail";
import { hashPassword } from "./passwords";
import { userFromToken } from "./session";
import { json, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.drop());
beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://kheti.example");
  vi.stubEnv("SMTP_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const none = { params: Promise.resolve({}) };
let n = 0;
const fresh = () => `new${++n}-${Math.random().toString(36).slice(2, 8)}@example.test`;
const ip = () => ({ "x-forwarded-for": `7.7.${Math.floor(++n / 250)}.${n % 250}` });
const ask = (u: TestUser | null, body: unknown, headers: Record<string, string> = ip()) =>
  requestRoute(req("/api/me/email", json(body, { cookie: u?.cookie, headers })), none);
const confirm = (u: TestUser | null, token: unknown, headers: Record<string, string> = ip()) =>
  confirmRoute(req("/api/me/email/confirm", json({ token }, { cookie: u?.cookie, headers })), none);
const tokenIn = (to: string) => /token=([\w-]+)/.exec(lastMail(to)?.text ?? "")?.[1] ?? "";
const emailOf = async (id: string) =>
  (await getSql()<{ email: string | null }[]>`SELECT email FROM users WHERE id = ${id}`)[0].email;

describe("requesting a change", () => {
  it("emails a link on SITE_URL to the NEW address, stores only a hash, and changes nothing yet", async () => {
    const u = await makeUser();
    const old = await emailOf(u.id);
    const to = fresh();
    const res = await ask(u, { email: to.toUpperCase() });
    expect(res.status).toBe(200);
    const mail = lastMail(to)!;
    expect(mail.text).toContain("https://kheti.example/settings/email?token=");
    const token = tokenIn(to);
    const rows = await getSql()<
      { token: string }[]
    >`SELECT token FROM verification_tokens WHERE identifier LIKE ${`email-change:${u.id}:%`}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].token).not.toContain(token);
    expect(await emailOf(u.id)).toBe(old);
  });

  it("answers 401 logged out, and rejects hostile or unknown input", async () => {
    expect((await ask(null, { email: fresh() })).status).toBe(401);
    const u = await makeUser();
    for (const body of [
      {},
      { email: "nope" },
      { email: fresh(), id: u.id },
      { email: 5 },
      null,
      [],
      { email: "a".repeat(300) + "@x.test" },
    ]) {
      expect((await ask(u, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("refuses the current address and an address another account uses", async () => {
    const a = await makeUser();
    const b = await makeUser();
    expect((await ask(a, { email: await emailOf(a.id) })).status).toBe(400);
    const res = await ask(a, { email: (await emailOf(b.id))!.toUpperCase() });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("email_taken");
  });

  it("is limited per user, per target address and per IP", async () => {
    const u = await makeUser();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await ask(u, { email: fresh() })).status);
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes.slice(5)).toEqual([429, 429]);
    const target = fresh();
    const out: number[] = [];
    for (let i = 0; i < 5; i++) out.push((await ask(await makeUser(), { email: target })).status);
    expect(out.filter((s) => s === 429).length).toBeGreaterThan(0);
    const same = { "x-forwarded-for": "6.6.6.6" };
    const byIp: number[] = [];
    for (let i = 0; i < 22; i++) byIp.push((await ask(await makeUser(), { email: fresh() }, same)).status);
    expect(byIp.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  it("a newer request replaces the older link", async () => {
    const u = await makeUser();
    const a = fresh();
    const b = fresh();
    await ask(u, { email: a });
    const first = tokenIn(a);
    await ask(u, { email: b });
    expect((await confirm(u, first)).status).toBe(400);
    expect((await confirm(u, tokenIn(b))).status).toBe(200);
    expect(await emailOf(u.id)).toBe(b);
  });

  it("503 and no stored token when links can't be built (no SITE_URL in production)", async () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    const u = await makeUser();
    expect((await ask(u, { email: fresh() })).status).toBe(503);
    const rows =
      await getSql()`SELECT 1 FROM verification_tokens WHERE identifier LIKE ${`email-change:${u.id}:%`}`;
    expect(rows).toHaveLength(0);
  });
});

describe("confirming", () => {
  it("applies the change, marks it verified, tells the old address, keeps sessions and the password", async () => {
    const me = await makeUser();
    await getSql()`UPDATE users SET password_hash = ${await hashPassword("long-enough-1")} WHERE id = ${me.id}`;
    const old = (await emailOf(me.id))!;
    const to = fresh();
    expect((await ask(me, { email: to, password: "long-enough-1" })).status).toBe(200);
    const res = await confirm(me, tokenIn(to));
    expect(res.status).toBe(200);
    expect(await emailOf(me.id)).toBe(to);
    const [row] = await getSql()<
      { v: Date | null; p: string | null }[]
    >`SELECT email_verified AS v, password_hash AS p FROM users WHERE id = ${me.id}`;
    expect(row.v).not.toBeNull();
    expect(row.p).not.toBeNull();
    expect(lastMail(old)?.text).toContain(to);
    expect((await userFromToken(me.token))?.id).toBe(me.id);
  });

  it("is single use, also under parallel clicks", async () => {
    const u = await makeUser();
    const to = fresh();
    await ask(u, { email: to });
    const token = tokenIn(to);
    const results = await Promise.all(Array.from({ length: 8 }, () => confirm(u, token)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await confirm(u, token)).status).toBe(400);
  });

  it("refuses an expired link", async () => {
    const u = await makeUser();
    const to = fresh();
    await ask(u, { email: to });
    await getSql()`UPDATE verification_tokens SET expires = now() - interval '1 second' WHERE identifier LIKE ${`email-change:${u.id}:%`}`;
    const res = await confirm(u, tokenIn(to));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("token_invalid");
  });

  it("belongs to the person who asked: logged out is 401, another user is refused and cannot burn it", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const to = fresh();
    await ask(a, { email: to });
    const token = tokenIn(to);
    expect((await confirm(null, token)).status).toBe(401);
    expect((await confirm(b, token)).status).toBe(400);
    expect(await emailOf(b.id)).not.toBe(to);
    expect((await confirm(a, token)).status).toBe(200);
  });

  it("garbage tokens are 400 and never touch the database as a pattern", async () => {
    const u = await makeUser();
    for (const token of ["", "short", "%", "a".repeat(500), 5, null, "x'; DROP TABLE users;--xxxxxxxxxx"])
      expect((await confirm(u, token)).status, String(token)).toBe(400);
  });

  it("two users racing for one address: exactly one gets it", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const to = fresh();
    await ask(a, { email: to });
    const ta = tokenIn(to);
    await ask(b, { email: to });
    const tb = tokenIn(to);
    const [ra, rb] = await Promise.all([confirm(a, ta), confirm(b, tb)]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
  });

  it("an address that got taken after the request is refused with email_taken", async () => {
    const a = await makeUser();
    const to = fresh();
    await ask(a, { email: to });
    const token = tokenIn(to);
    await makeUser(["renter"], { email: to });
    const res = await confirm(a, token);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("email_taken");
    expect(await emailOf(a.id)).not.toBe(to);
  });

  it("a Google-linked user keeps the Google link untouched", async () => {
    const u = await makeUser();
    await getSql()`INSERT INTO accounts (user_id, type, provider, provider_account_id) VALUES (${u.id}, 'oidc', 'google', ${`g-${u.id}`})`;
    const to = fresh();
    await ask(u, { email: to });
    expect((await confirm(u, tokenIn(to))).status).toBe(200);
    const rows = await getSql()`SELECT 1 FROM accounts WHERE user_id = ${u.id} AND provider = 'google'`;
    expect(rows).toHaveLength(1);
  });

  it("a person without an email can add one", async () => {
    const u = await makeUser();
    await getSql()`UPDATE users SET email = NULL WHERE id = ${u.id}`;
    const to = fresh();
    expect((await ask(u, { email: to })).status).toBe(200);
    expect((await confirm(u, tokenIn(to))).status).toBe(200);
    expect(await emailOf(u.id)).toBe(to);
  });

  it("deleting the account removes a pending link", async () => {
    const u = await makeUser();
    await ask(u, { email: fresh() });
    const { deleteAccount } = await import("./account");
    await deleteAccount({ id: u.id, name: null, email: null, phone: null, roles: ["renter"] });
    const rows =
      await getSql()`SELECT 1 FROM verification_tokens WHERE identifier LIKE ${`email-change:${u.id}:%`}`;
    expect(rows).toHaveLength(0);
  });
});

describe("a hijacked session", () => {
  it("cannot change a password account's email without the password", async () => {
    const u = await makeUser();
    await getSql()`UPDATE users SET password_hash = ${await hashPassword("long-enough-1")} WHERE id = ${u.id}`;
    const to = fresh();
    expect((await ask(u, { email: to })).status).toBe(400);
    const wrong = await ask(u, { email: to, password: "wrong-wrong-1" });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).code).toBe("password_wrong");
    expect(lastMail(to)).toBeUndefined();
    expect((await ask(u, { email: to, password: "long-enough-1" })).status).toBe(200);
  });
});
