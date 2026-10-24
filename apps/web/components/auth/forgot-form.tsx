"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { messageForApi } from "@/lib/auth-client-messages";
import { isValidEmail } from "@/lib/login-input";
import { useSessionState } from "@/lib/use-session-state";

/** Forgot password (UI-SPEC §4.3): the same answer whether or not the account exists. */
export function ForgotForm() {
  const t = useTranslations("pw");
  const tc = useTranslations();
  const toast = useToast();
  const [email, setEmail] = useSessionState("forgot.email", "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!isValidEmail(email)) {
      setError(tc("login.err.email"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; devLink?: string };
      if (!res.ok) setError(tc(messageForApi(body.code).key));
      else {
        setSent(true);
        setDevLink(body.devLink ?? null);
      }
    } catch {
      toast({ tone: "error", message: tc("errors.offlineSubmit") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="font-display text-[32px] font-bold leading-[38px]">{t("title")}</h1>
      <Input
        label={tc("login.emailAddr")}
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        error={error}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
      />
      <div role="status" className="empty:hidden">
        {sent && (
          <p className="rounded-control bg-success-bg p-3 text-small font-bold text-success">{t("sent")}</p>
        )}
      </div>
      {devLink && (
        <a href={devLink} className="text-caption text-text-subtle underline">
          {tc("login.devLink")}
        </a>
      )}
      <Button type="submit" loading={busy}>
        {t("send")}
      </Button>
      <Link
        href="/login"
        className="flex min-h-tap items-center justify-center font-bold text-link underline underline-offset-4"
      >
        {t("backToLogin")}
      </Link>
    </form>
  );
}
