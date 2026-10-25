// REVIEW §0.4: body text >= 7:1, all text >= 4.5:1, control borders >= 3:1 - checked on the token values, light and dark.
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(import.meta.dirname, "tokens.css"), "utf8");

function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("\n}", start);
  const vars: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = block(":root");
const dark = { ...light, ...block(':root[data-theme="dark"]') };

function rgb(vars: Record<string, string>, name: string): [number, number, number] {
  let v = vars[name];
  while (v.startsWith("var(")) v = vars[/var\(--([\w-]+)\)/.exec(v)![1]];
  const c = v.split(/\s+/).map(Number);
  if (c.length !== 3 || c.some(Number.isNaN)) throw new Error(`${name} is not a colour: ${v}`);
  return c as [number, number, number];
}
const lum = ([r, g, b]: number[]) =>
  [r, g, b]
    .map((x) => x / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (vars: Record<string, string>, a: string, b: string) => {
  const [hi, lo] = [lum(rgb(vars, a)), lum(rgb(vars, b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const THEMES = { light, dark } as const;
const FLOORS = ["bg", "surface", "surface-muted"];

describe.each(Object.entries(THEMES))("%s theme contrast", (_n, vars) => {
  it.each(FLOORS.flatMap((f) => ["text", "text-muted"].map((t) => [t, f])))(
    "body text %s on %s is at least 7:1",
    (t, f) => {
      expect(ratio(vars, t, f)).toBeGreaterThanOrEqual(7);
    },
  );

  it.each(
    FLOORS.flatMap((f) => ["text-subtle", "link", "success", "warning", "danger", "info"].map((t) => [t, f])),
  )("text %s on %s is at least 4.5:1", (t, f) => {
    expect(ratio(vars, t, f)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["success", "warning", "danger", "info"])(
    "%s text on its tinted background is at least 4.5:1",
    (k) => {
      expect(ratio(vars, k, `${k}-bg`)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("button text on the action fill, and on the selected fill, is at least 7:1", () => {
    expect(ratio(vars, "on-action", "action")).toBeGreaterThanOrEqual(7);
    expect(ratio(vars, "on-selected", "selected")).toBeGreaterThanOrEqual(7);
  });

  it.each(["bg", "surface"])("control border on %s is at least 3:1", (f) => {
    expect(ratio(vars, "border-control", f)).toBeGreaterThanOrEqual(3);
  });
});
