"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Pictogram, type MachineName } from "@/components/pictograms/pictogram";
import { Sheet } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Swipeable photos with dots and a "1 / 3" pill; a tap opens the photo larger (UI-SPEC §4.6). */
export function Carousel({
  photos,
  name,
  fallback,
  backHref,
}: {
  photos: { id: string; url: string }[];
  name: string;
  fallback: MachineName;
  backHref: string;
}) {
  const t = useTranslations("detail");
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  return (
    <div className="relative overflow-hidden bg-border-subtle md:rounded-card">
      <Link
        href={backHref}
        aria-label={t("back")}
        className="absolute left-3 top-3 z-10 flex h-[44px] w-[44px] items-center justify-center rounded-pill bg-white text-[#13100D] shadow-raised"
      >
        <ArrowLeft aria-hidden className="h-6 w-6" />
      </Link>
      {photos.length === 0 ? (
        <div
          role="img"
          aria-label={t("noPhoto")}
          className="flex h-[260px] items-center justify-center text-text-subtle lg:aspect-[4/3] lg:h-auto"
        >
          <Pictogram name={fallback} className="h-20 w-20" />
        </div>
      ) : (
        <>
          <div
            ref={strip}
            role="group"
            aria-label={t("photos")}
            onScroll={(e) => {
              const el = e.currentTarget;
              setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          >
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={t("openPhoto", { n: i + 1 })}
                onClick={() => {
                  setOpen(i);
                }}
                className="h-[260px] w-full shrink-0 snap-center lg:aspect-[4/3] lg:h-auto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- owner uploads are served by our own route */}
                <img
                  src={p.url}
                  alt={name}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
          {photos.length > 1 && (
            <>
              <p
                aria-live="polite"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-[rgb(19_16_13/0.7)] px-3 text-caption font-bold text-white"
              >
                {t("photoCount", { n: index + 1, total: photos.length })}
              </p>
              <div aria-hidden className="absolute bottom-[14px] right-3 flex gap-1">
                {photos.map((p, i) => (
                  <span
                    key={p.id}
                    className={cn("h-2 w-2 rounded-pill bg-white/60", i === index && "bg-white")}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {open !== null && (
        <Sheet
          open
          title={name}
          onClose={() => {
            setOpen(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- owner uploads are served by our own route */}
          <img
            src={photos[open].url}
            alt={name}
            className="max-h-[70svh] w-full rounded-control object-contain"
          />
        </Sheet>
      )}
    </div>
  );
}
