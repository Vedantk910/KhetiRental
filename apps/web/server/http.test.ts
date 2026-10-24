// @vitest-environment node
import { z } from "zod";
import en from "@/messages/en.json";
import { API_ERRORS, ApiError, errorBody, parse, readJson, route, uuidParam } from "./http";

const ctx = { params: Promise.resolve({} as Record<string, never>) };

describe("one error shape (C-04)", () => {
  it("every API error code has an English message", () => {
    expect(Object.keys(en.errors.api).sort()).toEqual([...API_ERRORS].sort());
  });
  it("body is { code, message: i18n key, field? }", () => {
    expect(errorBody("past_date", "startDate")).toEqual({
      code: "past_date",
      message: "errors.api.past_date",
      field: "startDate",
    });
  });
  it("parse → 400 invalid_request naming the field", () => {
    const e: unknown = (() => {
      try {
        return parse(z.object({ a: z.number() }), { a: "x" });
      } catch (x) {
        return x;
      }
    })();
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).field).toBe("a");
  });
});

describe("route()", () => {
  it("hides internal errors behind a 500 with the same shape", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await route(() => Promise.reject(new Error("db password is hunter2")))(
      new Request("http://x/a"),
      ctx,
    );
    spy.mockRestore();
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("hunter2");
  });
  it("refuses cross-site writes, allows same-site and reads", async () => {
    const ok = route(() => Promise.resolve(Response.json({ ok: true })));
    const mk = (method: string, origin?: string) =>
      new Request("http://localhost:3000/api/x", {
        method,
        headers: { host: "localhost:3000", ...(origin ? { origin } : {}) },
      });
    expect((await ok(mk("POST", "https://evil.example"), ctx)).status).toBe(403);
    expect((await ok(mk("POST", "not a url"), ctx)).status).toBe(403);
    expect((await ok(mk("POST", "http://localhost:3000"), ctx)).status).toBe(200);
    expect((await ok(mk("GET", "https://evil.example"), ctx)).status).toBe(200);
  });
  it("readJson requires JSON, bounded", async () => {
    const big = new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `"${"x".repeat(20_000)}"`,
    });
    await expect(readJson(big)).rejects.toMatchObject({ code: "invalid_json" });
    const form = new Request("http://x", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    await expect(readJson(form)).rejects.toMatchObject({ code: "invalid_json" });
  });
  it("non-UUID path ids are 404, not a cast error", () => {
    expect(() => uuidParam("1; DROP TABLE x")).toThrow(ApiError);
    expect(uuidParam("8E7C4C4E-0B1F-4A43-9D1A-3D3C9F0B1A11")).toBe("8e7c4c4e-0b1f-4a43-9d1a-3d3c9f0b1a11");
  });
});
