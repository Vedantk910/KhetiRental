"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";

/** The booking code, big; a tap copies it. */
export function CopyCode({ code }: { code: string }) {
  const t = useTranslations("bookings");
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={`${t("copyCode")}: ${code}`}
      onClick={() => {
        void navigator.clipboard
          .writeText(code)
          .then(() => {
            toast({ tone: "success", message: t("copied") });
          })
          .catch(() => undefined);
      }}
      className="inline-flex min-h-tap items-center gap-2 rounded-control text-h2 tabular-nums hover:bg-surface-muted"
    >
      {code}
      <Copy aria-hidden className="h-[20px] w-[20px] text-text-subtle" />
    </button>
  );
}
