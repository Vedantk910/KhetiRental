"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { messageForApi } from "@/lib/auth-client-messages";

/** New password from the emailed link (UI-SPEC §4.3). */
export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("pw");
  const tc = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<{ password?: string; again?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const e: typeof errors = {};
    if (password.length < 8) e.password = tc("login.err.passwordShort");
    else if (again !== password) e.again = t("mismatch");
    setErrors(e);
    setFormError(null);
    if (e.password || e.again) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        toast({ tone: "success", message: t("changed") });
        router.push("/login");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      if (body.code === "token_invalid") setExpired(true);
      else setFormError(tc(messageForApi(body.code).key));
    } catch {
      toast({ tone: "error", message: tc("errors.offlineSubmit") });
    } finally {
      setBusy(false);
    }
  }

  if (expired || !token)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-[32px] font-bold leading-[38px]">{t("title")}</h1>
        <p role="alert" className="rounded-control bg-danger-bg p-3 text-small font-bold text-danger">
          {tc("errors.api.token_invalid")}
        </p>
        <Link
          href="/login/forgot"
          className="flex min-h-tap items-center font-bold text-link underline underline-offset-4"
        >
          {t("askNew")}
        </Link>
      </div>
    );

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
      <PasswordInput
        label={t("newPassword")}
        name="new-password"
        autoComplete="new-password"
        hint={tc("login.passwordHint")}
        value={password}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
        }}
      />
      <PasswordInput
        label={t("confirm")}
        name="confirm-password"
        autoComplete="new-password"
        value={again}
        error={errors.again}
        onChange={(e) => {
          setAgain(e.target.value);
        }}
      />
      <div role="alert" className="empty:hidden">
        {formError && (
          <p className="rounded-control bg-danger-bg p-3 text-small font-bold text-danger">{formError}</p>
        )}
      </div>
      <Button type="submit" loading={busy}>
        {t("save")}
      </Button>
    </form>
  );
}
