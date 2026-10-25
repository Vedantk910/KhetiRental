import { config } from "@/config/site";

/** `tel:` link for the helpline, or null while it is still a placeholder (no dialling a made-up number). */
export function helplineHref(phone: string = config.helplinePhone): string | null {
  const d = phone.replace(/[\s()-]/g, "");
  return /^\+?\d{8,15}$/.test(d) ? `tel:${d}` : null;
}
