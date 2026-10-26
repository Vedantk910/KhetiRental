// The service worker's routing rules (public/sw-rules.js). The rule that matters most: nothing a signed-in
// person sees (pages, API answers) is ever stored.
import "../public/sw-rules.js";

type Kind = "pass" | "static" | "page";
const { route, PRECACHE, CACHE } = (
  globalThis as unknown as {
    krSw: {
      route: (r: { method: string; url: string; mode: string }, origin: string) => Kind;
      PRECACHE: string[];
      CACHE: string;
    };
  }
).krSw;

const ORIGIN = "https://kheti.example";
const get = (path: string, mode = "cors") => route({ method: "GET", url: ORIGIN + path, mode }, ORIGIN);

describe("what the service worker touches", () => {
  it("answers navigations from the network, falling back to the offline page, and never stores them", () => {
    for (const p of [
      "/en",
      "/mr/rent",
      "/hi/bookings/KR-1001",
      "/en/owner/requests/KR-2001",
      "/en/settings?x=1",
    ])
      expect(get(p, "navigate"), p).toBe("page");
  });

  it("keeps hashed build files and icons cached", () => {
    expect(get("/_next/static/chunks/main-abc123.js")).toBe("static");
    expect(get("/_next/static/media/font.woff2")).toBe("static");
    expect(get("/icons/icon-192.png")).toBe("static");
    expect(get("/offline.html")).toBe("static");
  });

  it("never touches API calls, whatever the mode or method", () => {
    for (const mode of ["cors", "navigate", "same-origin"]) {
      expect(get("/api/me", mode)).toBe("pass");
      expect(get("/api/bookings?x=1", mode)).toBe("pass");
      expect(get("/api/uploads/abc.png", mode)).toBe("pass");
    }
  });

  it("lets everything else go straight to the network", () => {
    expect(get("/en/rent?_rsc=abc")).toBe("pass"); // a React Server Components fetch is not a navigation
    expect(get("/models/tractor.glb")).toBe("pass");
    expect(get("/manifest.webmanifest")).toBe("pass");
  });

  it("ignores writes and other sites", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(route({ method, url: `${ORIGIN}/en/settings`, mode: "navigate" }, ORIGIN)).toBe("pass");
      expect(route({ method, url: `${ORIGIN}/_next/static/x.js`, mode: "cors" }, ORIGIN)).toBe("pass");
    }
    expect(
      route({ method: "GET", url: "https://evil.example/_next/static/x.js", mode: "cors" }, ORIGIN),
    ).toBe("pass");
    expect(route({ method: "GET", url: "https://evil.example/", mode: "navigate" }, ORIGIN)).toBe("pass");
  });

  it("treats path tricks as what they are", () => {
    expect(get("//evil.example/_next/static/x.js")).toBe("pass");
    expect(get("/api/../_next/static/x.js")).toBe("static"); // the URL parser has already resolved it
    expect(get("/_next/static/../../api/me")).toBe("pass");
    expect(get("/en/_next/static/x.js")).toBe("pass");
    expect(get("/API/me", "navigate")).toBe("page"); // paths are case-sensitive; this is just a missing page
  });

  it("precaches the offline page and only public files", () => {
    expect(PRECACHE).toContain("/offline.html");
    for (const p of PRECACHE) expect(p).toMatch(/^\/(offline\.html|icons\/)/);
    expect(CACHE).toMatch(/^kr-/);
  });
});
