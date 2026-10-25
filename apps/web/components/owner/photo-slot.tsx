"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import type { PhotoKey, PhotoSlot } from "@/lib/listing";

/** One photo place: a dashed 1:1 tile, "Take photo" and "Choose from gallery", ✕ to remove (UI-SPEC §4.11). */
export function PhotoSlotTile({
  slotKey,
  label,
  value,
  onChange,
  status,
}: {
  slotKey: PhotoKey;
  label: string;
  value: PhotoSlot | undefined;
  onChange: (v: PhotoSlot | undefined) => void;
  /** Shown under a filled slot (the RC's "pending review"). */
  status?: string;
}) {
  const t = useTranslations("list");
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setBad(false);
    try {
      const blob = await compressImage(f);
      onChange({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setBad(true);
    }
    setBusy(false);
  };
  const input = (ref: React.RefObject<HTMLInputElement | null>, capture: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(capture ? { capture: "environment" as const } : {})}
      hidden
      data-testid={`photo-${slotKey}-${capture ? "camera" : "gallery"}`}
      onChange={(e) => {
        void pick(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-control border-2 border-dashed border-chip bg-surface-muted text-text-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview of the file just chosen
          <img
            src={value.preview}
            alt={t("photoOf", { slot: label })}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <Camera aria-hidden className="h-8 w-8" />
            <span className="text-label">{label}</span>
          </div>
        )}
        {value && (
          <button
            type="button"
            aria-label={t("removePhoto", { slot: label })}
            onClick={() => {
              onChange(undefined);
            }}
            className="absolute right-1 top-1 flex h-tap w-tap items-center justify-center rounded-pill bg-surface text-text shadow-raised"
          >
            <X aria-hidden className="h-6 w-6" />
          </button>
        )}
      </div>
      {value ? (
        <p className="text-caption font-bold text-text-muted">{status ?? label}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            size="md"
            loading={busy}
            onClick={() => cam.current?.click()}
            className="!px-2 text-caption"
          >
            <Camera aria-hidden className="h-5 w-5 shrink-0" />
            {t("takePhoto")}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => gal.current?.click()}
            className="!px-2 text-caption"
          >
            <ImagePlus aria-hidden className="h-5 w-5 shrink-0" />
            {t("gallery")}
          </Button>
        </div>
      )}
      {input(cam, true)}
      {input(gal, false)}
      {bad && (
        <p role="alert" className="text-caption font-bold text-danger">
          {t("photoBad")}
        </p>
      )}
    </div>
  );
}
