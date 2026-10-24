// @vitest-environment node
import { createTestDb, type TestDb } from "./test/pg";
import { ApiError } from "./http";
import { lastSms } from "./mocks/sms";
import { mockGoogleUser } from "./mocks/google";
import { OTP_MAX_ATTEMPTS, sendOtp, signInWithOtp, verifyOtp } from "./otp";
import { loginWithPassword, requestPasswordReset, resetPassword, signup } from "./passwords";
import { hit } from "./rate-limit";
import { createSession, currentUser, deleteSession, hashToken, userFromToken } from "./session";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.drop());

let phoneN = 7_000_000_000;
const newPhone = () => `+91${++phoneN}`;
const codeFor = (phone: string) => /\b(\d{6})\b/.exec(lastSms(phone) ?? "")?.[1] ?? "";
const errCode = async (p: Promise<unknown>) => {
  const e: unknown = await p.then(
    () => null,
    (x: unknown) => x,
  );
  return e instanceof ApiError ? e.code : e;
};
const age = (phone: string, secs: number) =>
  t.sql`UPDATE otp_codes SET sent_at = sent_at - make_interval(secs => ${secs}),
        expires_at = expires_at - make_interval(secs => ${secs}) WHERE phone = ${phone}`;

describe("phone OTP (UI-SPEC §4.3, D-05)", () => {
  it("sends a 6-digit code, stores only its hash, and signs up a new user", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.1");
    const code = codeFor(phone);
    expect(code).toMatch(/^\d{6}$/);
    const [row] = await t.sql<
      { code_hash: string }[]
    >`SELECT code_hash FROM otp_codes WHERE phone = ${phone}`;
    expect(row.code_hash).not.toContain(code);
    const u = await signInWithOtp({ phone, code, name: "Sunil Pawar", roles: ["renter", "owner"] });
    expect(u.roles).toEqual(["renter", "owner"]);
    const [db] = await t.sql<
      { phone_verified_at: Date | null }[]
    >`SELECT phone_verified_at FROM users WHERE id = ${u.id}`;
    expect(db.phone_verified_at).not.toBeNull();
    // the code is single use
    expect(await errCode(verifyOtp(phone, code))).toBe("otp_expired");
  });

  it("a new number needs a name", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.2");
    expect(await errCode(signInWithOtp({ phone, code: codeFor(phone) }))).toBe("invalid_request");
  });

  it("existing users log in without a name", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.3");
    const a = await signInWithOtp({ phone, code: codeFor(phone), name: "Asha" });
    await age(phone, 31);
    await sendOtp(phone, "1.1.1.3");
    const b = await signInWithOtp({ phone, code: codeFor(phone) });
    expect(b.id).toBe(a.id);
  });

  it("expires after 5 minutes", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.4");
    await age(phone, 5 * 60 + 1);
    expect(await errCode(verifyOtp(phone, codeFor(phone)))).toBe("otp_expired");
  });

  it("allows 5 attempts, reports tries left, then locks even the right code", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.5");
    const right = codeFor(phone);
    const wrong = right === "000000" ? "111111" : "000000";
    const left: unknown[] = [];
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
      const e: unknown = await verifyOtp(phone, wrong).catch((x: unknown) => x);
      left.push(e instanceof ApiError ? [e.code, e.details?.triesLeft] : e);
    }
    expect(left).toEqual([
      ["otp_wrong", 4],
      ["otp_wrong", 3],
      ["otp_wrong", 2],
      ["otp_wrong", 1],
    ]);
    expect(await errCode(verifyOtp(phone, wrong))).toBe("otp_locked");
    expect(await errCode(verifyOtp(phone, right))).toBe("otp_locked");
  });

  it("resend waits 30 s, then issues a fresh code and resets attempts", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.6");
    const first = codeFor(phone);
    expect(await errCode(sendOtp(phone, "1.1.1.6"))).toBe("otp_resend_wait");
    await age(phone, 31);
    await sendOtp(phone, "1.1.1.6");
    const [row] = await t.sql<{ attempts: number }[]>`SELECT attempts FROM otp_codes WHERE phone = ${phone}`;
    expect(row.attempts).toBe(0);
    const second = codeFor(phone);
    if (second !== first) expect(await errCode(verifyOtp(phone, first))).toBe("otp_wrong");
  });

  it("adversarial: 50 parallel guesses from many clients get at most 5 tries in total", async () => {
    const phone = newPhone();
    await sendOtp(phone, "1.1.1.7");
    const right = codeFor(phone);
    const guesses = Array.from({ length: 50 }, (_, i) =>
      String((Number(right) + 1 + i) % 1_000_000).padStart(6, "0"),
    );
    const results = await Promise.all(guesses.map((g) => errCode(verifyOtp(phone, g))));
    expect(results.filter((r) => r === "otp_wrong")).toHaveLength(OTP_MAX_ATTEMPTS - 1);
    expect(results.filter((r) => r === "otp_locked")).toHaveLength(50 - (OTP_MAX_ATTEMPTS - 1));
    expect(await errCode(verifyOtp(phone, right))).toBe("otp_locked");
  });

  it("rate-limits sends per phone (5/hour)", async () => {
    const phone = newPhone();
    for (let i = 0; i < 5; i++) {
      await sendOtp(phone, `2.2.2.${i}`);
      await age(phone, 31);
    }
    expect(await errCode(sendOtp(phone, "2.2.2.9"))).toBe("rate_limited");
  });

  it("hostile phone/code input never reaches SQL unparsed", async () => {
    expect(await errCode(verifyOtp("' OR 1=1 --", "123456"))).toBe("invalid_request");
    expect(await errCode(verifyOtp(newPhone(), "12345x"))).toBe("invalid_request");
  });
});

describe("email + password", () => {
  it("signs up with argon2, logs in, and never says which part was wrong", async () => {
    const u = await signup({
      name: "Ramesh Patil",
      email: "Ramesh@Example.com",
      password: "kheti-2026",
      roles: ["owner"],
    });
    const [row] = await t.sql<
      { password_hash: string }[]
    >`SELECT password_hash FROM users WHERE id = ${u.id}`;
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect((await loginWithPassword("ramesh@example.com", "kheti-2026", "3.3.3.1"))?.id).toBe(u.id);
    expect(await loginWithPassword("ramesh@example.com", "wrong-pass", "3.3.3.1")).toBeNull();
    expect(await loginWithPassword("nobody@example.com", "kheti-2026", "3.3.3.1")).toBeNull();
  });

  it("rejects short passwords and duplicate emails", async () => {
    expect(
      await errCode(
        signup({ name: "Short", email: "s@example.com", password: "1234567", roles: ["renter"] }),
      ),
    ).toBe("invalid_request");
    await signup({ name: "Dup", email: "dup@example.com", password: "password1", roles: ["renter"] });
    expect(
      await errCode(
        signup({ name: "Dup", email: "DUP@example.com", password: "password1", roles: ["renter"] }),
      ),
    ).toBe("email_taken");
  });

  it("locks password login after 5 failures in 10 minutes", async () => {
    await signup({ name: "Lock", email: "lock@example.com", password: "password1", roles: ["renter"] });
    for (let i = 0; i < 5; i++) await loginWithPassword("lock@example.com", "nope-nope", `4.4.4.${i}`);
    expect(await errCode(loginWithPassword("lock@example.com", "password1", "4.4.4.9"))).toBe("rate_limited");
  });

  it("resets a password with a single-use token and ends old sessions", async () => {
    const u = await signup({
      name: "Reset",
      email: "reset@example.com",
      password: "password1",
      roles: ["renter"],
    });
    const session = await createSession(u.id);
    const token = await requestPasswordReset("reset@example.com");
    expect(token).toBeTruthy();
    expect(await requestPasswordReset("ghost@example.com")).toBeNull();
    await resetPassword(token!, "new-password-1");
    expect(await userFromToken(session)).toBeNull();
    expect(await loginWithPassword("reset@example.com", "new-password-1", "5.5.5.5")).not.toBeNull();
    expect(await errCode(resetPassword(token!, "another-pass"))).toBe("token_invalid");
  });
});

describe("mock Google and sessions", () => {
  it("signs in the same seeded demo user every time", async () => {
    const a = await mockGoogleUser();
    const b = await mockGoogleUser();
    expect(a.id).toBe(b.id);
    expect(a.name).toBe("Demo Google User");
  });

  it("stores only a hash of the session token, and expired or deleted sessions are refused", async () => {
    const u = await mockGoogleUser();
    const token = await createSession(u.id);
    const [row] = await t.sql<
      { session_token: string }[]
    >`SELECT session_token FROM sessions WHERE session_token = ${hashToken(token)}`;
    expect(row.session_token).not.toBe(token);
    const r = new Request("http://x/api", { headers: { cookie: `a=b; authjs.session-token=${token}` } });
    expect((await currentUser(r))?.id).toBe(u.id);
    await deleteSession(token);
    expect(await currentUser(r)).toBeNull();
    const t2 = await createSession(u.id);
    await t.sql`UPDATE sessions SET expires = now() - interval '1 second' WHERE session_token = ${hashToken(t2)}`;
    expect(await userFromToken(t2)).toBeNull();
    expect(await userFromToken("x".repeat(5000))).toBeNull();
  });
});

describe("rate limiter", () => {
  it("counts atomically across parallel callers", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => hit("test:parallel", 10, 60)));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });
  it("opens a new window after it expires", async () => {
    for (let i = 0; i < 3; i++) await hit("test:window", 3, 60);
    expect((await hit("test:window", 3, 60)).ok).toBe(false);
    await t.sql`UPDATE rate_limits SET window_start = now() - interval '61 seconds' WHERE key = 'test:window'`;
    expect((await hit("test:window", 3, 60)).ok).toBe(true);
  });
});
