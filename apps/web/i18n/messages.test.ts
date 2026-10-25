import en from "../messages/en.json";
import hi from "../messages/hi.json";
import mr from "../messages/mr.json";
import { withEnglishFallback } from "./messages";

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ""): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v]] : flat(v, `${p}${k}.`)));

describe("withEnglishFallback", () => {
  it("replaces an untranslated (TODO-translate) message with the English one", () => {
    const out = withEnglishFallback(
      { a: { b: "Hello", c: "Bye" } },
      { a: { b: "TODO-translate: Hello", c: "Alvida" } },
    );
    expect(out).toEqual({ a: { b: "Hello", c: "Alvida" } });
  });

  it("fills a missing key from English", () => {
    expect(withEnglishFallback({ x: "X", y: "Y" }, { x: "ex" })).toEqual({ x: "ex", y: "Y" });
  });

  it.each([
    ["hi", hi],
    ["mr", mr],
    ["en", en],
  ])("%s: no visitor-facing message contains TODO-translate and every key exists", (_l, cat) => {
    const out = flat(withEnglishFallback(en, cat));
    expect(out.filter(([, v]) => v.includes("TODO-translate"))).toEqual([]);
    expect(out.map(([k]) => k).sort()).toEqual(
      flat(en)
        .map(([k]) => k)
        .sort(),
    );
  });
});
