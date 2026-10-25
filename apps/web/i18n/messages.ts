type Tree = { [k: string]: string | Tree };

const TODO = "TODO-translate: ";

/**
 * Messages for one language. A key that is missing, or still marked "TODO-translate: <English>" in the
 * catalogue, shows the English text instead, so visitors never see the marker. The marked entries stay in
 * hi.json / mr.json as the translators' work list.
 */
export function withEnglishFallback(en: Tree, own: Tree): Tree {
  const out: Tree = {};
  for (const [k, base] of Object.entries(en)) {
    const v = own[k];
    if (typeof base !== "string") out[k] = withEnglishFallback(base, typeof v === "object" ? v : {});
    else out[k] = typeof v === "string" && !v.startsWith(TODO) ? v : base;
  }
  return out;
}
