"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ResultsError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    const on = () => {
      reset();
    };
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("online", on);
    };
  }, [reset]);
  return (
    <div className="mx-auto flex max-w-app flex-col items-start gap-3 px-4 py-8 sm:px-6">
      <p role="alert" className="rounded-card bg-danger-bg p-4 text-small text-danger">
        {t("results.error")}
      </p>
      <Button variant="secondary" onClick={reset}>
        {t("common.tryAgain")}
      </Button>
    </div>
  );
}
