// Mock listing-time KYC (D-07). Runs in the browser only; no file content is read or sent.
export const IMPLEMENTS = [
  "Rotavator",
  "Plough",
  "Seed drill",
  "Trailer",
  "Sprayer",
  "Harvester attachment",
] as const;
export const HP_OPTIONS = [
  { value: "35", label: "35 HP" },
  { value: "45", label: "45 HP" },
  { value: "55", label: "55 HP" },
  { value: "75_4wd", label: "75 HP 4WD" },
] as const;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
export const namesMatch = (a: string, b: string) => !!norm(a) && norm(a) === norm(b);

const OK_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;
export function checkDocument(f: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  if (!OK_TYPES.includes(f.type)) return { ok: false, message: "Use a PDF, JPG or PNG file." };
  if (f.size <= 0) return { ok: false, message: "That file is empty." };
  if (f.size > MAX_BYTES) return { ok: false, message: "That file is over 5 MB. Use a smaller scan." };
  return { ok: true };
}

export interface ListingForm {
  make: string;
  model: string;
  year: string;
  hp: string;
  implements: string[];
  cost: string;
  listerName: string;
  rcName: string;
}

export function validateListing(
  f: ListingForm,
  now = new Date().getFullYear(),
): Partial<Record<keyof ListingForm, string>> {
  const e: Partial<Record<keyof ListingForm, string>> = {};
  if (!f.make.trim()) e.make = "Enter the make, for example Mahindra.";
  if (!f.model.trim()) e.model = "Enter the model.";
  const y = Number(f.year);
  if (!Number.isInteger(y) || y < now - 40 || y > now)
    e.year = `Enter a year between ${now - 40} and ${now}.`;
  if (!HP_OPTIONS.some((o) => o.value === f.hp)) e.hp = "Pick the horsepower tier.";
  if (f.implements.length === 0) e.implements = "Pick at least one implement you rent out with it.";
  const c = Number(f.cost);
  if (!(f.cost.trim() && Number.isFinite(c) && c >= 50_000 && c <= 5_000_000))
    e.cost = "Enter what you paid, from ₹50,000 to ₹50,00,000.";
  if (!f.listerName.trim()) e.listerName = "Enter your full name.";
  if (!f.rcName.trim()) e.rcName = "Enter the owner name printed on the RC.";
  else if (f.listerName.trim() && !namesMatch(f.listerName, f.rcName)) {
    e.rcName =
      "The RC owner name does not match your name, so we cannot list this tractor. Use the RC that is registered to you.";
  }
  return e;
}
