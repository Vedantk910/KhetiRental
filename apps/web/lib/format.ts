import type { Locale } from "@/i18n/routing";

const tag = (l: Locale) => `${l}-IN`;

/** Whole rupees, Indian grouping (12,34,567) in every locale, with that locale's own digits (mr → Devanagari). */
export function formatRupees(paise: number, locale: Locale): string {
  const nu = new Intl.NumberFormat(tag(locale)).resolvedOptions().numberingSystem;
  // mr-IN's CLDR grouping is Western (1,234,567); en-IN carries the Indian pattern, so borrow it.
  return new Intl.NumberFormat(`en-IN-u-nu-${nu}`, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(paise / 100) || 0);
}

/** A number with at most one decimal, in the locale's own digits (mr → Devanagari). */
export const formatNumber = (n: number, locale: Locale) =>
  n.toLocaleString(tag(locale), { maximumFractionDigits: 1 });

/** ₹ with two decimals and Indian grouping, always English digits (engineering pages). */
export const formatInr2 = (rupees: number) =>
  `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Mon 2 Nov – Wed 4 Nov" in India time, localised names and digits. */
export function formatDateRange(from: Date, to: Date, locale: Locale): string {
  const f = new Intl.DateTimeFormat(tag(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const one = (d: Date) =>
    f
      .formatToParts(d)
      .map((p) => (p.type === "literal" ? p.value.replace(",", "") : p.value))
      .join("");
  const a = one(from);
  const b = one(to);
  return a === b ? a : `${a} – ${b}`;
}

const DEVA_ZERO = 0x0966;

/** Parses what farmers type into number fields: Devanagari digits and a decimal comma. NaN on anything else. */
export function toAsciiNumber(s: string): number {
  const ascii = s
    .trim()
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - DEVA_ZERO))
    .replace(/^(-?\d+),(\d+)$/, "$1.$2");
  return /^-?\d+(\.\d+)?$/.test(ascii) ? Number(ascii) : NaN;
}

/** "Ramesh Patil" → "Ramesh P." (other people see no more than this). */
export function shortName(name: string | null): string {
  const [first = "", last] = (name ?? "").trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
}
