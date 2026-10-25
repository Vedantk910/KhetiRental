// The messages a visitor sees in each language: untranslated keys show the English text (see i18n/messages.ts).
import { readFileSync } from "node:fs";
import { withEnglishFallback } from "../i18n/messages";

export type Messages = typeof import("../messages/en.json");
const raw = (l: string) =>
  JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8")) as Messages;

const en = raw("en");
export const MESSAGES = {
  en,
  hi: withEnglishFallback(en, raw("hi")) as Messages,
  mr: withEnglishFallback(en, raw("mr")) as Messages,
};
