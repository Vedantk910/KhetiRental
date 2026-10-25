import { IntlMessageFormat } from "intl-messageformat";
import en from "./en.json";
import hi from "./hi.json";
import mr from "./mr.json";

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ""): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v]] : flat(v, `${p}${k}.`)));

const files = { en, hi, mr } as Record<string, Tree>;
const keys = (t: Tree) =>
  flat(t)
    .map(([k]) => k)
    .sort();

describe("message catalogues", () => {
  it("en, hi and mr have identical key sets", () => {
    expect(keys(files.hi)).toEqual(keys(files.en));
    expect(keys(files.mr)).toEqual(keys(files.en));
  });

  it.each(Object.keys(files))("%s: every message is valid ICU", (lang) => {
    for (const [k, v] of flat(files[lang])) {
      expect(() => new IntlMessageFormat(v, lang), k).not.toThrow();
    }
  });

  it("placeholders agree across languages (except TODO-translate fallbacks)", () => {
    const vars = (s: string) => [...new Set(s.match(/\{(\w+)/g) ?? [])].sort();
    const enMap = new Map(flat(files.en));
    for (const lang of ["hi", "mr"]) {
      for (const [k, v] of flat(files[lang])) expect(vars(v), `${lang} ${k}`).toEqual(vars(enMap.get(k)!));
    }
  });

  it("English is complete; missing hi/mr strings are marked, never silently filled", () => {
    expect(flat(files.en).filter(([, v]) => v.includes("TODO-translate"))).toEqual([]);
    for (const lang of ["hi", "mr"]) {
      for (const [k, v] of flat(files[lang])) {
        if (v.startsWith("TODO-translate: ")) expect(v.slice(16), k).toBe(new Map(flat(files.en)).get(k));
      }
    }
  });

  it("carries the UI-SPEC §11 strings verbatim (spot checks)", () => {
    expect(en.common.brand).toBe("KhetiRental");
    expect(mr.common.lang.mr).toBe("मराठी");
    expect(hi.otp.wrong).toBe("कोड गलत है। {n} कोशिश बाकी।");
    expect(en.search.days).toBe("{n, plural, one {# day} other {# days}}");
    expect(mr.pay.card).toBe("डेबिट / क्रेडिट कार्ड");
    expect(en.units.acre).toBe("/ acre");
    expect(en.story.s1.caption).toMatch(/^Each square/);
  });

  // REVIEW T-01: words a farmer may not know stay out of the farmer-facing copy ("demo" is allowed: payments are mock only).
  it("English copy avoids the jargon the review banned", () => {
    const banned =
      /escrow|authoris|authoriz|pre-auth|telematics|geofence|dossier|sandbox|\bADR\b|take rate|k-ring|Res 8|marketplace|implements|\blistings?\b|tier floor/i;
    const hits = flat(files.en).filter(([k, v]) => banned.test(v) && !k.startsWith("engineering."));
    expect(hits).toEqual([]);
  });

  // REVIEW T-02: sentence case in the navigation.
  it("navigation labels are in sentence case", () => {
    for (const [k, v] of flat(files.en).filter(([k]) => k.startsWith("nav.") && !k.endsWith("Label")))
      expect(v, k).toMatch(/^[A-Z][^A-Z]*$/);
  });
});
