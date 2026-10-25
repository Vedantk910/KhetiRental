"use client";

import { ArrowLeft, LocateFixed } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pictogram, type MachineName } from "@/components/pictograms/pictogram";
import { PlaceInput } from "@/components/rent/place-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input, Select } from "@/components/ui/field";
import { PriceRow } from "@/components/ui/price-row";
import { StickyCTA } from "@/components/ui/sticky-cta";
import { TileGroup } from "@/components/ui/tile";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { ATTACHMENTS, CATEGORIES, keepPaise, PRICE_UNITS, type Category, type PriceUnit } from "@/lib/domain";
import { formatRupees, toAsciiNumber } from "@/lib/format";
import {
  emptyDraft,
  fromMachine,
  makeName,
  MAKES,
  sundaysBetween,
  toPayload,
  validateStep,
  type Draft,
  type Errors,
  type PhotoKey,
  type Photos,
  type ServerMachine,
} from "@/lib/listing";
import { shiftMonth } from "@/lib/rent";
import { addDays, todayIst } from "@/server/pricing";
import { MonthGrid } from "./month-grid";
import { PhotoSlotTile } from "./photo-slot";

const PinMap = dynamic(() => import("./pin-map"), {
  ssr: false,
  loading: () => <div className="h-[220px]" />,
});

const PICTO: Record<Category, MachineName> = {
  tractor: "tractor",
  rotavator: "rotavator",
  seed_drill: "seedDrill",
  sprayer: "sprayer",
  combine_harvester: "combine",
  thresher: "thresher",
  trolley: "trolley",
};
const MACHINE_KEY: Record<
  Category,
  "tractor" | "rotavator" | "seedDrill" | "sprayer" | "combine" | "thresher" | "trolley"
> = {
  tractor: "tractor",
  rotavator: "rotavator",
  seed_drill: "seedDrill",
  sprayer: "sprayer",
  combine_harvester: "combine",
  thresher: "thresher",
  trolley: "trolley",
};
const DRAFT_KEY = "kr:listing-draft:v1";
const HORIZON_DAYS = 60;
const EXTRA_KEYS = ["extra1", "extra2", "extra3"] as const;
const UPLOAD_ORDER: PhotoKey[] = ["front", "side", "meter", "extra1", "extra2", "extra3", "rc"];

export interface EditMachine extends ServerMachine {
  id: string;
  active: boolean;
  rcStatus: string;
  photos: { id: string; url: string; kind: string }[];
}

function photosOf(m: EditMachine): Photos {
  const out: Photos = {};
  let extra = 0;
  for (const p of m.photos) {
    const key: PhotoKey | undefined =
      p.kind === "extra"
        ? EXTRA_KEYS[extra++]
        : (["front", "side", "meter", "rc"] as const).find((k) => k === p.kind);
    if (key && !out[key]) out[key] = { preview: p.url, id: p.id };
  }
  return out;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center gap-3 text-body">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="h-6 w-6 shrink-0 accent-[rgb(var(--action))]"
      />
      {label}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label">{title}</p>
      {children}
    </div>
  );
}

/** List a machine / edit one: 4 steps with a sticky Next, a draft saved on the phone (UI-SPEC §4.11). */
export function Wizard({
  machine,
  initialStep,
}: {
  machine?: EditMachine;
  initialStep: 1 | 2 | 3 | 4 | null;
}) {
  const t = useTranslations("list");
  const tc = useTranslations("common");
  const tm = useTranslations("machines");
  const ta = useTranslations("attach");
  const td = useTranslations("detail");
  const te = useTranslations("errors.api");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const editing = !!machine;
  const year = new Date().getFullYear();
  const today = todayIst();

  const [step, setStepState] = useState<1 | 2 | 3 | 4>(initialStep ?? 1);
  const [draft, setDraft] = useState<Draft>(() => (machine ? fromMachine(machine) : emptyDraft()));
  const [photos, setPhotos] = useState<Photos>(() => (machine ? photosOf(machine) : {}));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoBad, setGeoBad] = useState(false);
  const [hint, setHint] = useState<{ min: number; max: number } | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const created = useRef<string | null>(null);
  const uploaded = useRef(new Set<PhotoKey>());
  const done = useRef(false);
  const initialBlocked = useRef(machine?.blockedDays ?? []);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // Steps live in the URL (?step=), so Back and a refresh land on the same step.
  const setStep = useCallback((n: 1 | 2 | 3 | 4, push = true) => {
    setStepState(n);
    setTried(false);
    setError(null);
    if (push) {
      const u = new URL(window.location.href);
      u.searchParams.set("step", String(n));
      window.history.pushState(null, "", u);
    }
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onPop = () => {
      const n = Number(new URL(window.location.href).searchParams.get("step") ?? 1);
      setStepState(n >= 1 && n <= 4 ? (n as 1 | 2 | 3 | 4) : 1);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // The draft (without photos) is kept on this phone; restored after the first paint.
  useEffect(() => {
    if (editing) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { draft?: Partial<Draft>; step?: number };
      if (saved.draft) setDraft({ ...emptyDraft(), ...saved.draft });
      if (initialStep === null && saved.step && saved.step >= 1 && saved.step <= 4)
        setStep(saved.step as 1 | 2 | 3 | 4, false);
    } catch {
      // private mode or a damaged draft: start fresh
    }
  }, [editing, initialStep, setStep]);
  useEffect(() => {
    if (editing || done.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step }));
    } catch {
      // storage blocked: the form still works
    }
  }, [draft, step, editing]);

  const errors: Errors = useMemo(() => validateStep(step, draft, photos, year), [step, draft, photos, year]);
  const shown = tried ? errors : {};

  // "Similar machines near you charge …" (step 4)
  useEffect(() => {
    if (step !== 4 || draft.lat === null || draft.lng === null) return;
    const ac = new AbortController();
    const q = new URLSearchParams({
      category: draft.category,
      unit: draft.unit,
      lat: String(draft.lat),
      lng: String(draft.lng),
    });
    fetch(`/api/owner/price-hint?${q}`, { signal: ac.signal })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ n: number; minRupees?: number; maxRupees?: number }>) : null,
      )
      .then((j) => {
        setHint(j && j.n > 0 && j.minRupees && j.maxRupees ? { min: j.minRupees, max: j.maxRupees } : null);
      })
      .catch(() => undefined);
    return () => {
      ac.abort();
    };
  }, [step, draft.category, draft.unit, draft.lat, draft.lng]);

  const go = () => {
    if (Object.keys(errors).length > 0) {
      setTried(true);
      return;
    }
    if (step < 4) setStep((step + 1) as 2 | 3 | 4);
    else void publish();
  };

  const locate = () => {
    setGeoBad(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        fetch(`/api/places?lat=${lat}&lng=${lng}`)
          .then((r) =>
            r.ok
              ? (r.json() as Promise<{ item: { pin: string; village: string; label: string } | null }>)
              : null,
          )
          .then((j) => {
            const item = j?.item;
            if (!item) throw new Error("none");
            setDraft((d) => ({ ...d, lat, lng, pin: item.pin, village: item.village, place: item.label }));
          })
          .catch(() => {
            setGeoBad(true);
          });
      },
      () => {
        setGeoBad(true);
      },
      { timeout: 10_000 },
    );
  };

  const apiError = async (r: Response) => {
    const j = (await r.json().catch(() => ({}))) as { code?: string };
    const known = [
      "day_booked",
      "file_too_large",
      "file_type",
      "too_many_photos",
      "rate_limited",
      "invalid_request",
      "forbidden",
    ] as const;
    return te(known.find((k) => k === j.code) ?? "internal", { phone: "" });
  };
  const call = async (url: string, init: RequestInit) => {
    const r = await fetch(url, init);
    if (!r.ok && r.status !== 204) throw new Error(await apiError(r));
    return r;
  };
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const publish = async () => {
    if (busy) return;
    // Anything earlier that is still wrong sends the owner back to it.
    for (const s of [1, 2, 3] as const) {
      if (Object.keys(validateStep(s, draft, photos, year)).length > 0) {
        setStep(s);
        setTried(true);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const body = toPayload(draft);
      let id = machine?.id ?? created.current;
      if (!id) {
        // Created paused: it goes live only once its photos are in.
        const r = await call("/api/owner/machines", json("POST", { ...body, active: false }));
        id = ((await r.json()) as { id: string }).id;
        created.current = id;
      } else if (editing) await call(`/api/owner/machines/${id}`, json("PATCH", body));

      const original = machine ? photosOf(machine) : {};
      for (const key of UPLOAD_ORDER) {
        const slot = photos[key];
        const was = original[key];
        // A replaced RC is swapped by the server; every other replaced or removed photo is deleted first.
        if (was && (!slot || (slot.blob && key !== "rc")))
          await call(`/api/owner/machines/${id}/photos/${was.id}`, { method: "DELETE" });
        if (slot?.blob && !uploaded.current.has(key)) {
          const fd = new FormData();
          fd.set("photo", slot.blob, "photo.webp");
          fd.set("kind", key.startsWith("extra") ? "extra" : key);
          await call(`/api/owner/machines/${id}/photos`, { method: "POST", body: fd });
          uploaded.current.add(key);
        }
      }

      const before = new Set(initialBlocked.current);
      const now = new Set(draft.blocked);
      const unblock = [...before].filter((d) => !now.has(d));
      const block = [...now].filter((d) => !before.has(d));
      if (unblock.length)
        await call(`/api/owner/machines/${id}/blocks`, json("PUT", { days: unblock, blocked: false }));
      if (block.length)
        await call(`/api/owner/machines/${id}/blocks`, json("PUT", { days: block, blocked: true }));
      initialBlocked.current = draft.blocked;

      if (!editing) await call(`/api/owner/machines/${id}`, json("PATCH", { active: true }));
      done.current = true;
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // nothing to clean up
      }
      toast({
        tone: "success",
        message: editing ? t("saved") : t("live", { name: `${makeName(draft)} ${draft.model.trim()}` }),
      });
      router.push("/owner");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("publishFailed"));
      setBusy(false);
    }
  };

  const unitWord = { hour: t("perHourLower"), acre: t("perAcreLower"), day: t("perDayLower") }[draft.unit];
  const price = toAsciiNumber(draft.price);
  const priceOk = Number.isInteger(price) && price >= 1 && price <= 100_000;
  const money = (rupees: number) => formatRupees(rupees * 100, locale);
  const keep = priceOk ? keepPaise(price * 100) : 0;
  const machineLabel = tm(MACHINE_KEY[draft.category]).toLocaleLowerCase(locale);

  const startMonth = today.slice(0, 7);
  const end = addDays(today, HORIZON_DAYS);
  const sundays = sundaysBetween(today, end);
  const allSundays = sundays.every((d) => draft.blocked.includes(d));

  const title = [t("s1"), t("s2"), t("s3"), t("s4")][step - 1];
  const fieldErr = (k: keyof Errors, msg: string) => (shown[k] ? msg : undefined);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pb-8 pt-2 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => {
              if (step > 1) setStep((step - 1) as 1 | 2 | 3);
              else router.push("/owner");
            }}
            className="flex h-tap w-tap shrink-0 items-center justify-center rounded-pill text-text hover:bg-surface-muted"
          >
            <ArrowLeft aria-hidden className="h-6 w-6" />
          </button>
          <div>
            <p className="text-caption font-bold text-text-subtle">{t("step", { n: step })}</p>
            <h1 className="text-h3">{title}</h1>
          </div>
        </div>
        <div aria-hidden className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-[6px] rounded-pill ${n <= step ? "bg-action" : "bg-chip"}`} />
          ))}
        </div>
      </header>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <TileGroup
            label={t("category")}
            className="grid-cols-2"
            value={draft.category}
            onChange={(v) => {
              set("category", v as Category);
            }}
            options={CATEGORIES.map((c) => ({
              value: c,
              label: tm(MACHINE_KEY[c]),
              icon: <Pictogram name={PICTO[c]} />,
            }))}
          />
          <Select
            label={t("company")}
            value={draft.make}
            error={fieldErr("make", t("required"))}
            onChange={(e) => {
              set("make", e.target.value);
            }}
          >
            <option value="">{t("companyPick")}</option>
            {MAKES.map((k) => (
              <option key={k} value={k}>
                {t(`makes.${k}`)}
              </option>
            ))}
          </Select>
          {draft.make === "other" && (
            <Input
              label={t("companyOther")}
              maxLength={40}
              value={draft.makeOther}
              onChange={(e) => {
                set("makeOther", e.target.value);
              }}
            />
          )}
          <Input
            label={t("model")}
            maxLength={60}
            value={draft.model}
            error={fieldErr("model", draft.model.trim().length > 40 ? t("modelLong") : t("required"))}
            onChange={(e) => {
              set("model", e.target.value);
            }}
          />
          {draft.category === "tractor" && (
            <Input
              label={t("hp")}
              inputMode="numeric"
              autoComplete="off"
              value={draft.hp}
              error={fieldErr("hp", t("hpRange"))}
              onChange={(e) => {
                set("hp", e.target.value);
              }}
            />
          )}
          <Input
            label={t("year")}
            inputMode="numeric"
            autoComplete="off"
            value={draft.year}
            error={fieldErr("year", t("yearRange", { min: year - 40, max: year }))}
            onChange={(e) => {
              set("year", e.target.value);
            }}
          />
          <Input
            label={t("hourMeter")}
            inputMode="numeric"
            autoComplete="off"
            value={draft.hourMeter}
            onChange={(e) => {
              set("hourMeter", e.target.value);
            }}
          />
          <Input
            label={t("lastServiced")}
            type="month"
            max={today.slice(0, 7)}
            value={draft.lastServiced}
            onChange={(e) => {
              set("lastServiced", e.target.value);
            }}
          />
          <Section title={t("comesWith")}>
            <ChipGroup
              multiple
              label={t("comesWith")}
              value={draft.attachments}
              onChange={(v) => {
                set("attachments", v as Draft["attachments"]);
              }}
              options={ATTACHMENTS.map((a) => ({ value: a, label: ta(a) }))}
            />
          </Section>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-small text-text-muted">{t("photoTip")}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {(
              [
                ["front", t("slotFront")],
                ["side", t("slotSide")],
                ["meter", t("slotMeter")],
                ...EXTRA_KEYS.map((k) => [k, t("slotExtra")] as const),
              ] as const
            ).map(([k, label]) => (
              <PhotoSlotTile
                key={k}
                slotKey={k}
                label={label}
                value={photos[k]}
                onChange={(v) => {
                  setPhotos((p) => ({ ...p, [k]: v }));
                }}
              />
            ))}
          </div>
          {shown.photos && (
            <p role="alert" className="rounded-control bg-danger-bg p-3 text-small font-bold text-danger">
              {t("photosNeeded")}
            </p>
          )}
          <div className="max-w-[260px]">
            <PhotoSlotTile
              slotKey="rc"
              label={t("slotRc")}
              value={photos.rc}
              status={machine?.rcStatus === "checked" && photos.rc?.id ? t("rcChecked") : t("rcPending")}
              onChange={(v) => {
                setPhotos((p) => ({ ...p, rc: v }));
              }}
            />
          </div>
          <p className="text-caption text-text-subtle">{t("rcHint")}</p>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Section title={t("where")}>
            <PlaceInput
              value={draft.place}
              onText={(v) => {
                setDraft((d) => ({ ...d, place: v, pin: "", village: "", lat: null, lng: null }));
              }}
              onPick={(o) => {
                setDraft((d) => ({
                  ...d,
                  place: o.label,
                  pin: o.pin,
                  village: o.village,
                  lat: o.lat,
                  lng: o.lng,
                }));
              }}
            />
            {shown.place && (
              <p role="alert" className="text-caption font-bold text-danger">
                {t("locationNeeded")}
              </p>
            )}
            <Button variant="secondary" size="md" onClick={locate} className="self-start">
              <LocateFixed aria-hidden className="h-[20px] w-[20px]" />
              {t("useLocation")}
            </Button>
            {geoBad && (
              <p role="alert" className="text-caption font-bold text-danger">
                {t("locationDenied")}
              </p>
            )}
            {draft.lat !== null && draft.lng !== null && (
              <>
                <p role="status" className="text-small text-text-muted">
                  {t("locationSet", { place: draft.place })}
                </p>
                <PinMap
                  lat={draft.lat}
                  lng={draft.lng}
                  onMove={(lat, lng) => {
                    set("lat", lat);
                    set("lng", lng);
                  }}
                />
              </>
            )}
            <p className="text-caption text-text-subtle">{t("locationHint")}</p>
          </Section>
          <section aria-labelledby="fd-h" className="flex flex-col gap-2">
            <h2 id="fd-h" className="text-label">
              {t("freeDays")}
            </h2>
            <MonthGrid
              month={month}
              onMonth={setMonth}
              canPrev={month > startMonth}
              canNext={month < shiftMonth(startMonth, 1)}
              state={(d) => (d < today || d > end ? "past" : draft.blocked.includes(d) ? "blocked" : "free")}
              onPick={(d) => {
                set(
                  "blocked",
                  draft.blocked.includes(d) ? draft.blocked.filter((x) => x !== d) : [...draft.blocked, d],
                );
              }}
            />
            <p className="text-caption text-text-subtle">{t("freeDaysHint")}</p>
            <Toggle
              label={t("blockSundays")}
              checked={allSundays}
              onChange={(on) => {
                set(
                  "blocked",
                  on
                    ? [...new Set([...draft.blocked, ...sundays])].sort()
                    : draft.blocked.filter((d) => !sundays.includes(d)),
                );
              }}
            />
          </section>
          <Toggle
            label={t("drive")}
            checked={draft.operator}
            onChange={(v) => {
              set("operator", v);
            }}
          />
          <Toggle
            label={t("diesel")}
            checked={draft.diesel}
            onChange={(v) => {
              set("diesel", v);
            }}
          />
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <Card className="flex items-center gap-3">
            {photos.front ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview or our own upload
              <img
                src={photos.front.preview}
                alt=""
                className="h-[64px] w-[64px] shrink-0 rounded-control object-cover"
              />
            ) : (
              <Pictogram name={PICTO[draft.category]} className="h-16 w-16 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-body font-bold">
                {makeName(draft)} {draft.model.trim()}
                {draft.category === "tractor" && draft.hp ? ` · ${td("hp", { hp: draft.hp })}` : ""}
              </p>
              <p className="text-small text-text-muted">
                {draft.village}
                {draft.attachments.length > 0
                  ? ` · ${draft.attachments.map((a) => ta(a).toLocaleLowerCase(locale)).join(", ")}`
                  : ""}
              </p>
            </div>
          </Card>
          <Section title={t("howCharge")}>
            <ChipGroup
              label={t("howCharge")}
              value={draft.unit}
              onChange={(v) => {
                set("unit", v as PriceUnit);
              }}
              options={PRICE_UNITS.map((u) => ({
                value: u,
                label: { hour: t("perHour"), acre: t("perAcre"), day: t("perDay") }[u],
              }))}
            />
          </Section>
          <Input
            label={t("yourPrice", { per: unitWord })}
            prefix="₹"
            inputMode="numeric"
            autoComplete="off"
            value={draft.price}
            error={fieldErr("price", t("priceRange"))}
            onChange={(e) => {
              set("price", e.target.value);
            }}
          />
          {hint && (
            <p className="rounded-control bg-[rgb(var(--sarson-100))] p-3 text-small text-[rgb(var(--n-950))]">
              {t("similar", {
                range: t("range", { min: money(hint.min), max: money(hint.max), per: unitWord }),
              })}
            </p>
          )}
          <Card className="flex flex-col gap-2" aria-live="polite">
            <PriceRow label={t("farmerPays")} value={priceOk ? money(price) : "–"} />
            <PriceRow
              label={t("fee", { pct: t("feeValue") })}
              value={priceOk ? `− ${formatRupees(price * 100 - keep, locale)}` : "–"}
            />
            <PriceRow
              total
              label={t("keep")}
              value={<span className="text-success">{priceOk ? formatRupees(keep, locale) : "–"}</span>}
            />
          </Card>
          <Toggle
            label={t("drive")}
            checked={draft.operator}
            onChange={(v) => {
              set("operator", v);
            }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-control bg-danger-bg p-3 text-small font-bold text-danger">
          {error}
        </p>
      )}
      <StickyCTA>
        <Button loading={busy} onClick={go}>
          {step < 4 ? tc("next") : editing ? t("save") : t("publish", { machine: machineLabel })}
        </Button>
      </StickyCTA>
      {!editing && <p className="text-caption text-text-subtle">{t("draftNote")}</p>}
    </div>
  );
}
