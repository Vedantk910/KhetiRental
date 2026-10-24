import type { Locale } from "@/i18n/routing";

const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** UI-SPEC §4.1.3: 1 − (1 − p)³. */
export const easeOutCubic = (p: number) => 1 - (1 - clamp01(p)) ** 3;

/** Linear progress 0..1 of a run that started `elapsedMs` ago. */
export const progressAt = (elapsedMs: number, durationMs: number) => clamp01(elapsedMs / durationMs);

/** The number shown at linear progress `p`: locale digits (mr → Devanagari), fixed decimals, optional suffix. */
export function formatCount(target: number, p: number, decimals: number, suffix: string, locale: Locale) {
  const value = p >= 1 ? target : target * easeOutCubic(p);
  const n = new Intl.NumberFormat(`${locale}-IN`, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return n + suffix;
}
