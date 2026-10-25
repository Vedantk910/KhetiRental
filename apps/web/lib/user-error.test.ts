import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { UserError, userMessage } from "./user-error";

describe("userMessage", () => {
  it("shows the text of an error made for the user", () => {
    expect(userMessage(new UserError("Try again"), "fallback")).toBe("Try again");
  });
  it.each([new TypeError("Failed to fetch"), new Error("encode"), "x", null])("never shows %s", (e) => {
    expect(userMessage(e, "fallback")).toBe("fallback");
  });
});

// REVIEW T-03/T-07: a caught error's own message (developer language, English only) is never put on screen.
describe("components never render a caught error's message", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(p) && !p.endsWith(".test.tsx") ? [p] : [];
    });
  it("has no `e instanceof Error ? e.message` in any component", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const bad = [...files(path.join(root, "components")), ...files(path.join(root, "app"))].filter((f) =>
      /instanceof Error\s*(&&|\?)\s*\w+\.message/.test(readFileSync(f, "utf8")),
    );
    expect(bad).toEqual([]);
  });
});
