"use client";

import { Camera, Mic, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useSessionState } from "@/lib/use-session-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { TileGroup } from "@/components/ui/tile";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { PROBLEM_TYPES } from "@/lib/domain";
import { useSpeech } from "./use-speech";

const KEY = {
  no_show: "noShow",
  broke_down: "breakdown",
  damage: "damage",
  overcharged: "overcharge",
  other: "other",
  renter_no_show: "renterNoShow",
  late_return: "lateReturn",
  not_paid: "notPaid",
} as const;
const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

/** "What went wrong?" (UI-SPEC §4.10): a picture choice, up to 3 photos, optional words. */
export function ProblemForm({
  bookingId,
  code,
  role,
}: {
  bookingId: string;
  code: string;
  role: "renter" | "owner";
}) {
  const t = useTranslations("problem");
  const te = useTranslations("errors.api");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useSessionState(`problem.${code}.type`, "", { onlyAfterSwitch: true });
  const [text, setText] = useSessionState(`problem.${code}.text`, "", { onlyAfterSwitch: true });
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const speech = useSpeech(locale, (s) => {
    setText((x) => `${x}${x ? " " : ""}${s}`.slice(0, 1000));
  });

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list];
    if (photos.length + picked.length > MAX_PHOTOS) setError(t("tooMany"));
    else if (picked.some((f) => f.size > MAX_BYTES)) setError(te("file_too_large"));
    else {
      setError(null);
      setPhotos((p) => [...p, ...picked]);
    }
    if (file.current) file.current.value = "";
  };

  const send = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!type) {
      setError(t("choose"));
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("type", type);
    if (text.trim()) fd.set("text", text.trim());
    for (const f of photos) fd.append("photos", f);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/problems`, { method: "POST", body: fd });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { code?: string };
        const known = [
          "file_too_large",
          "file_type",
          "too_many_photos",
          "rate_limited",
          "invalid_request",
        ] as const;
        setError(te(known.find((k) => k === j.code) ?? "internal", { phone: "" }));
        setBusy(false);
        return;
      }
      toast({ tone: "success", message: t("sent") });
      router.push(`/bookings/${code}`);
    } catch {
      setError(te("internal", { phone: "" }));
      setBusy(false);
    }
  };

  return (
    <form
      method="post"
      onSubmit={(e) => void send(e)}
      className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-4 pb-8 sm:px-6"
    >
      <h1 className="text-h1">{t("title")}</h1>
      <TileGroup
        label={t("types")}
        value={type}
        onChange={setType}
        className="grid-cols-2"
        options={PROBLEM_TYPES[role].map((x) => ({ value: x, label: t(KEY[x]) }))}
      />
      <div className="flex flex-col gap-2">
        <p className="text-label">{t("photos")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex min-h-tap items-center gap-2 rounded-pill bg-surface-muted pl-3 text-small"
            >
              {f.name.slice(0, 18)}
              <button
                type="button"
                aria-label={t("removePhoto", { n: i + 1 })}
                onClick={() => {
                  setPhotos((p) => p.filter((_, j) => j !== i));
                }}
                className="flex h-tap w-tap items-center justify-center rounded-pill hover:bg-chip"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </span>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Button type="button" variant="secondary" size="md" onClick={() => file.current?.click()}>
              <Camera aria-hidden className="h-[20px] w-[20px]" />
              {t("addPhoto")}
            </Button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            data-testid="problem-photos"
            onChange={(e) => {
              add(e.target.files);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Textarea
          label={t("text")}
          value={text}
          maxLength={1000}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        {speech.supported && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={speech.toggle}
            aria-pressed={speech.listening}
          >
            <Mic aria-hidden className="h-[20px] w-[20px]" />
            {t("speak")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        {t("send")}
      </Button>
    </form>
  );
}
