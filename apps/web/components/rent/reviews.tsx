"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

export interface Review {
  stars: number;
  text: string | null;
  authorShortName: string;
  createdAt: string | Date;
}

function Quote({ r }: { r: Review }) {
  const locale = useLocale();
  const when = new Intl.DateTimeFormat(`${locale}-IN`, {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(r.createdAt));
  return (
    <blockquote className="flex flex-col gap-1 border-l-4 border-chip pl-3">
      <p className="text-small">{"★".repeat(r.stars)}</p>
      {r.text && <p className="text-body">{r.text}</p>}
      <footer className="text-caption text-text-subtle">
        — {r.authorShortName}, {when}
      </footer>
    </blockquote>
  );
}

/** Two quotes and a sheet with all of them, 10 at a time (UI-SPEC §4.6). Text is plain text, never HTML. */
export function Reviews({
  machineId,
  preview,
  count,
}: {
  machineId: string;
  preview: Review[];
  count: number;
}) {
  const t = useTranslations("detail");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Review[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const load = async (c: string | null) => {
    setState("loading");
    try {
      const r = await fetch(`/api/machines/${machineId}/reviews${c ? `?cursor=${c}` : ""}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { items: Review[]; nextCursor: string | null };
      setItems((xs) => (c ? [...xs, ...j.items] : j.items));
      setCursor(j.nextCursor);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  if (count === 0) return <p className="text-small text-text-muted">{t("noReviews")}</p>;
  return (
    <div className="flex flex-col gap-4">
      {preview.slice(0, 2).map((r, i) => (
        <Quote key={i} r={r} />
      ))}
      {count > 2 && (
        <div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setOpen(true);
              void load(null);
            }}
          >
            {t("allReviews", { n: count })}
          </Button>
        </div>
      )}
      {open && (
        <Sheet
          open
          title={t("reviewsTitle")}
          onClose={() => {
            setOpen(false);
          }}
        >
          <div className="flex flex-col gap-4">
            {items.map((r, i) => (
              <Quote key={i} r={r} />
            ))}
            {state === "error" && (
              <p role="alert" className="text-small text-danger">
                {tc("tryAgain")}
              </p>
            )}
            {(cursor || state === "error") && (
              <Button variant="secondary" loading={state === "loading"} onClick={() => void load(cursor)}>
                {t("loadMore")}
              </Button>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
