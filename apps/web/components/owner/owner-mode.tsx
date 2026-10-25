"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Renters see this before the listing wizard (UI-SPEC §3.1). */
export function OwnerMode() {
  const t = useTranslations("owner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-h2">{t("modeTitle")}</h1>
      <Card className="flex flex-col gap-4">
        <p className="text-body">{t("modeBody")}</p>
        {error && (
          <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
            {t("modeFailed")}
          </p>
        )}
        <Button
          loading={busy}
          onClick={() => {
            setBusy(true);
            setError(false);
            fetch("/api/owner/enable", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
            })
              .then((r) => {
                if (!r.ok) throw new Error();
                // The tab bar learns the new role from the next page load.
                window.location.reload();
              })
              .catch(() => {
                setError(true);
                setBusy(false);
              });
          }}
        >
          {t("modeOn")}
        </Button>
      </Card>
    </div>
  );
}
