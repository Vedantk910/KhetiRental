"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/** The emailed link lands here. A click (not the page load) redeems the token, so mail scanners can't spend it. */
export function EmailConfirm({ token }: { token: string }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [state, setState] = useState<{ done?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    const res = await fetch("/api/me/email/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { code?: string; email?: string } | undefined;
    if (res?.ok && j?.email) setState({ done: j.email });
    else
      setState({
        error: res
          ? te(`api.${j?.code ?? "internal"}` as "api.internal", { phone: "", n: 0 })
          : te("network"),
      });
    setBusy(false);
  };

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-h1">{t("emailPageTitle")}</h1>
      {state.done ? (
        <p role="status" className="break-words text-body">
          {t("emailPageDone", { email: state.done })}
        </p>
      ) : (
        <>
          <p className="text-body text-text-muted">{t("emailPageBody")}</p>
          {state.error && (
            <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
              {state.error}
            </p>
          )}
          {token && !state.error && (
            <Button loading={busy} className="self-start" onClick={() => void go()}>
              {t("emailPageGo")}
            </Button>
          )}
        </>
      )}
      <ButtonLink href="/settings" variant="secondary" size="md" className="self-start">
        {t("emailPageBack")}
      </ButtonLink>
    </div>
  );
}
