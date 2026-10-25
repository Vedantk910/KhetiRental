// @vitest-environment node
// What a real deployment relies on without any paid service: reset links by SMTP, phone login switched off,
// Google users stored like everyone else. Adversarial cases: enumeration, token reuse, Host tricks, racing sign-ups.
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { createTransport } from "nodemailer";
import { POST as forgot } from "@/app/api/auth/forgot/route";
import { POST as otp } from "@/app/api/auth/otp/route";
import { getDb } from "./db";
import { accounts, sessions, users, verificationTokens } from "./db/schema";
import { ApiError } from "./http";
import { sendOtp } from "./otp";
import { requestPasswordReset, resetPassword, signup } from "./passwords";
import { createTestDb, type TestDb } from "./test/pg";

const sent: { to: string; text: string }[] = [];
const afterTasks: Promise<unknown>[] = [];
vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<unknown>) => void afterTasks.push(fn()),
}));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.drop());
beforeEach(() => {
  sent.length = 0;
  vi.mocked(createTransport).mockReturnValue({
    sendMail: (m: { to: string; text: string }) => Promise.resolve(void sent.push(m)),
  } as never);
  vi.stubEnv("SMTP_URL", "smtps://me%40gmail.com:pw@smtp.gmail.com:465");
  vi.stubEnv("SITE_URL", "https://kheti.example");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

let n = 0;
const ip = () => `9.9.${Math.floor(++n / 250)}.${n % 250}`;
const post = async (
  handler: typeof forgot,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  const res = await handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip(), ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
  await Promise.all(afterTasks.splice(0));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const errCode = async (p: Promise<unknown>) => {
  const e: unknown = await p.then(
    () => null,
    (x: unknown) => x,
  );
  return e instanceof ApiError ? e.code : e;
};
const newUser = (email: string) =>
  signup({ name: "Asha", email, password: "long-enough-1", roles: ["renter"] });

describe("password reset by email", () => {
  it("emails an absolute link on SITE_URL even when the request claims another host", async () => {
    await newUser("host@example.test");
    const r = await post(
      forgot,
      "http://evil.example/api/auth/forgot",
      { email: "host@example.test" },
      {
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        origin: "http://evil.example",
        "x-forwarded-proto": "http",
      },
    );
    expect(r.status).toBe(200);
    expect(r.body.devLink).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("host@example.test");
    expect(sent[0].text).toMatch(/https:\/\/kheti\.example\/login\/reset\?token=[\w-]{20,}/);
    expect(sent[0].text).not.toContain("evil.example");
  });

  it("sends nothing, and says so in the log, when SITE_URL is unusable in a real deployment", async () => {
    await newUser("nosite@example.test");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "x".repeat(40));
    vi.stubEnv("ENABLE_MOCK_AUTH", "");
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await post(forgot, "http://evil.example/api/auth/forgot", { email: "nosite@example.test" });
    expect(r.status).toBe(200);
    expect(sent).toHaveLength(0);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("answers the same for an unknown email and mails only the real one", async () => {
    await newUser("real@example.test");
    const a = await post(forgot, "http://localhost/api/auth/forgot", { email: "real@example.test" });
    const b = await post(forgot, "http://localhost/api/auth/forgot", { email: "ghost@example.test" });
    expect(b).toEqual(a);
    expect(sent.map((m) => m.to)).toEqual(["real@example.test"]);
  });

  it("caps reset emails per address, whoever asks", async () => {
    await newUser("bomb@example.test");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++)
      statuses.push(
        (await post(forgot, "http://localhost/api/auth/forgot", { email: "bomb@example.test" })).status,
      );
    expect(statuses.filter((s) => s === 429).length).toBe(2);
    expect(sent.length).toBe(5);
  });

  it("a link works once, even when it is used from many tabs at the same time", async () => {
    await newUser("reuse@example.test");
    const token = (await requestPasswordReset("reuse@example.test"))!;
    const tries = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => resetPassword(token, `new-password-${i}`)),
    );
    expect(tries.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await errCode(resetPassword(token, "another-pass-1"))).toBe("token_invalid");
  });

  it("asking again replaces the earlier link", async () => {
    await newUser("again@example.test");
    const first = (await requestPasswordReset("again@example.test"))!;
    const second = (await requestPasswordReset("again@example.test"))!;
    expect(await errCode(resetPassword(first, "new-password-1"))).toBe("token_invalid");
    await resetPassword(second, "new-password-1");
  });
});

describe("phone login without an SMS provider", () => {
  const production = () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "x".repeat(40));
    vi.stubEnv("ENABLE_MOCK_AUTH", "");
    vi.stubEnv("SMS_PROVIDER", "");
    vi.stubEnv("SMS_API_KEY", "");
  };

  it("answers 503 phone_login_unavailable and stores no code", async () => {
    production();
    const r = await post(otp, "http://localhost/api/auth/otp", { phone: "+919876500001" });
    expect(r).toMatchObject({ status: 503, body: { code: "phone_login_unavailable" } });
    expect(await t.sql`SELECT 1 FROM otp_codes WHERE phone = '+919876500001'`).toHaveLength(0);
  });

  it("a provider name nobody implemented does not count as configured", async () => {
    production();
    vi.stubEnv("SMS_PROVIDER", "somesms");
    vi.stubEnv("SMS_API_KEY", "key");
    expect(await errCode(sendOtp("+919876500002", ip()))).toBe("phone_login_unavailable");
  });

  it("dev and e2e keep the on-screen code", async () => {
    const r = await post(otp, "http://localhost/api/auth/otp", { phone: "+919876500003" });
    expect(r.status).toBe(200);
    expect(r.body.devCode).toMatch(/^\d{6}$/);
  });
});

describe("sign-up races", () => {
  it("many parallel sign-ups with one email make exactly one account", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        signup({
          name: `Racer ${i}`,
          email: i % 2 ? "Race@Example.test" : "race@example.test",
          password: "long-enough-1",
          roles: ["renter"],
        }),
      ),
    );
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const codes = results.flatMap((x) => (x.status === "rejected" ? [(x.reason as ApiError).code] : []));
    expect(new Set(codes)).toEqual(new Set(["email_taken"]));
    expect(await t.sql`SELECT 1 FROM users WHERE email = 'race@example.test'`).toHaveLength(1);
  });
});

describe("Google sign-in rows (Auth.js adapter)", () => {
  const adapter = () =>
    DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    });

  it("a new Google user gets name, email, image and the renter role", async () => {
    const a = adapter();
    const u = await a.createUser!({
      id: "ignored",
      name: "Gita Patil",
      email: "gita@example.test",
      image: "https://lh3.example/gita.png",
      emailVerified: new Date(),
    });
    await a.linkAccount!({
      userId: u.id,
      type: "oidc",
      provider: "google",
      providerAccountId: "g-1",
    });
    const [row] = await t.sql<{ name: string; email: string; image: string; roles: string[] }[]>`
      SELECT name, email, image, roles FROM users WHERE id = ${u.id}`;
    expect(row).toEqual({
      name: "Gita Patil",
      email: "gita@example.test",
      image: "https://lh3.example/gita.png",
      roles: ["renter"],
    });
    expect((await a.getUserByAccount!({ provider: "google", providerAccountId: "g-1" }))?.id).toBe(u.id);
  });

  it("an email that already has a password account is not merged by the adapter", async () => {
    // Auth.js refuses to link a Google login to an existing email account unless the provider opts in
    // (allowDangerousEmailAccountLinking), so a squatter who signed up with someone else's address can't take over a Google login.
    const a = adapter();
    const mine = await newUser("pw-first@example.test");
    expect((await a.getUserByEmail!("pw-first@example.test"))?.id).toBe(mine.id);
    expect(await a.getUserByAccount!({ provider: "google", providerAccountId: "g-2" })).toBeNull();
  });
});
