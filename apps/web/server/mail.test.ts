// @vitest-environment node
import { createTransport } from "nodemailer";
import { lastMail, sendMail, siteUrl } from "./mail";

vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));
const sent: Record<string, unknown>[] = [];
beforeEach(() => {
  sent.length = 0;
  vi.mocked(createTransport).mockReset();
  vi.mocked(createTransport).mockReturnValue({
    sendMail: (m: Record<string, unknown>) => Promise.resolve(void sent.push(m)),
  } as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendMail", () => {
  it("keeps the mock outbox when no SMTP_URL is set and never opens a connection", async () => {
    vi.stubEnv("SMTP_URL", "");
    await sendMail({ to: "a@example.test", subject: "Hi", text: "body" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(lastMail("a@example.test")?.text).toBe("body");
  });

  it("sends through SMTP_URL with MAIL_FROM", async () => {
    vi.stubEnv("SMTP_URL", "smtps://me%40gmail.com:app-pass@smtp.gmail.com:465");
    vi.stubEnv("MAIL_FROM", "KhetiRental <me@gmail.com>");
    await sendMail({ to: "a@example.test", subject: "Hi", text: "body" });
    expect(createTransport).toHaveBeenCalledWith("smtps://me%40gmail.com:app-pass@smtp.gmail.com:465");
    expect(sent).toEqual([
      { from: "KhetiRental <me@gmail.com>", to: "a@example.test", subject: "Hi", text: "body" },
    ]);
  });

  it("falls back to the SMTP login as the sender", async () => {
    vi.stubEnv("SMTP_URL", "smtps://me%40gmail.com:pw@smtp.gmail.com:465");
    vi.stubEnv("MAIL_FROM", "");
    await sendMail({ to: "a@example.test", subject: "Hi", text: "body" });
    expect(sent[0].from).toBe("me@gmail.com");
  });
});

describe("siteUrl", () => {
  it("is the origin of SITE_URL, without path or trailing slash", () => {
    vi.stubEnv("SITE_URL", "https://kheti.example/some/path/");
    expect(siteUrl()).toBe("https://kheti.example");
  });
  it("refuses anything that is not http(s)", () => {
    vi.stubEnv("SITE_URL", "javascript:alert(1)");
    expect(siteUrl()).toBeNull();
  });
  it("is null in a real deployment without SITE_URL, localhost where mocks may log", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_MOCK_AUTH", "");
    expect(siteUrl()).toBeNull();
    vi.stubEnv("ENABLE_MOCK_AUTH", "1");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
