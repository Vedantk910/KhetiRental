// The listing wizard's data (UI-SPEC §4.11): validation per step, the API payload, the draft. Pure and testable.
import { ATTACHMENTS, CATEGORIES, type Attachment, type Category, type PriceUnit } from "./domain";
import { toAsciiNumber } from "./format";
import { addDays, parseDay } from "@/server/pricing";

export const MAKES = [
  "mahindra",
  "swaraj",
  "sonalika",
  "john_deere",
  "new_holland",
  "kubota",
  "eicher",
  "massey_ferguson",
  "escorts",
  "other",
] as const;
const MAKE_NAME: Record<string, string | undefined> = {
  mahindra: "Mahindra",
  swaraj: "Swaraj",
  sonalika: "Sonalika",
  john_deere: "John Deere",
  new_holland: "New Holland",
  kubota: "Kubota",
  eicher: "Eicher",
  massey_ferguson: "Massey Ferguson",
  escorts: "Escorts",
};

export interface Draft {
  category: Category;
  make: string;
  makeOther: string;
  model: string;
  hp: string;
  year: string;
  hourMeter: string;
  lastServiced: string;
  attachments: Attachment[];
  place: string;
  pin: string;
  village: string;
  lat: number | null;
  lng: number | null;
  blocked: string[];
  operator: boolean;
  diesel: boolean;
  unit: PriceUnit;
  price: string;
}

export const emptyDraft = (): Draft => ({
  category: "tractor",
  make: "",
  makeOther: "",
  model: "",
  hp: "",
  year: "",
  hourMeter: "",
  lastServiced: "",
  attachments: [],
  place: "",
  pin: "",
  village: "",
  lat: null,
  lng: null,
  blocked: [],
  operator: true,
  diesel: true,
  unit: "acre",
  price: "",
});

export type PhotoKey = "front" | "side" | "meter" | "extra1" | "extra2" | "extra3" | "rc";
export interface PhotoSlot {
  preview: string;
  blob?: Blob;
  /** Set when the photo is already on the server (edit). */
  id?: string;
}
export type Photos = Partial<Record<PhotoKey, PhotoSlot>>;
const REQUIRED_PHOTOS = ["front", "side", "meter"] as const;

export const makeName = (d: Pick<Draft, "make" | "makeOther">) =>
  d.make === "other" ? d.makeOther.trim() : (MAKE_NAME[d.make] ?? "");

export const int = (s: string) => {
  const n = toAsciiNumber(s);
  return Number.isInteger(n) ? n : NaN;
};

export type Errors = Partial<Record<"make" | "model" | "hp" | "year" | "photos" | "place" | "price", true>>;

/** `year` is the current year (a parameter so tests don't age). */
export function validateStep(step: 1 | 2 | 3 | 4, d: Draft, photos: Photos, year: number): Errors {
  const e: Errors = {};
  if (step === 1) {
    if (!makeName(d) || makeName(d).length > 40) e.make = true;
    if (!d.model.trim() || d.model.trim().length > 40) e.model = true;
    if (d.category === "tractor") {
      const hp = int(d.hp);
      if (!(hp >= 10 && hp <= 150)) e.hp = true;
    }
    const y = int(d.year);
    if (!(y >= year - 40 && y <= year)) e.year = true;
  } else if (step === 2) {
    if (!REQUIRED_PHOTOS.every((k) => photos[k])) e.photos = true;
  } else if (step === 3) {
    if (d.lat === null || d.lng === null || !d.pin) e.place = true;
  } else {
    const p = int(d.price);
    if (!(p >= 1 && p <= 100_000)) e.price = true;
  }
  return e;
}

/** The body of POST/PATCH /api/owner/machines. */
export function toPayload(d: Draft) {
  const meter = int(d.hourMeter);
  return {
    category: d.category,
    make: makeName(d),
    model: d.model.trim(),
    hp: d.category === "tractor" ? int(d.hp) : null,
    year: int(d.year),
    hourMeter: Number.isNaN(meter) ? null : meter,
    lastServiced: d.lastServiced ? `${d.lastServiced}-01` : null,
    attachments: d.attachments,
    lat: d.lat as number,
    lng: d.lng as number,
    village: d.village,
    pin: d.pin,
    priceUnit: d.unit,
    priceRupees: int(d.price),
    operatorIncluded: d.operator,
    dieselIncluded: d.diesel,
  };
}

export interface ServerMachine {
  category: string;
  make: string;
  model: string;
  hp: number | null;
  year: number;
  hourMeter: number | null;
  lastServiced: string | null;
  attachments: string[];
  lat: number;
  lng: number;
  village: string;
  pin: string;
  priceUnit: string;
  priceRupees: number;
  operatorIncluded: boolean;
  dieselIncluded: boolean;
  blockedDays: string[];
}

export function fromMachine(m: ServerMachine): Draft {
  const key = MAKES.find((k) => MAKE_NAME[k]?.toLowerCase() === m.make.toLowerCase());
  return {
    category: (CATEGORIES as readonly string[]).includes(m.category) ? (m.category as Category) : "tractor",
    make: key ?? "other",
    makeOther: key ? "" : m.make,
    model: m.model,
    hp: m.hp === null ? "" : String(m.hp),
    year: String(m.year),
    hourMeter: m.hourMeter === null ? "" : String(m.hourMeter),
    lastServiced: m.lastServiced?.slice(0, 7) ?? "",
    attachments: m.attachments.filter((a): a is Attachment => (ATTACHMENTS as readonly string[]).includes(a)),
    place: `${m.pin} · ${m.village}`,
    pin: m.pin,
    village: m.village,
    lat: m.lat,
    lng: m.lng,
    blocked: m.blockedDays,
    operator: m.operatorIncluded,
    diesel: m.dieselIncluded,
    unit: m.priceUnit as PriceUnit,
    price: String(m.priceRupees),
  };
}

/** Scale (w, h) so the long side is at most `max`; small images stay as they are. */
export function fitWithin(w: number, h: number, max: number) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Every Sunday from `from` to `to`, both inclusive (YYYY-MM-DD). */
export function sundaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (new Date(parseDay(d)).getUTCDay() === 0) out.push(d);
  return out;
}
