"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { postLoginPath } from "@/lib/access";
import { messageForApi, messageForSignIn, type AuthMessage } from "@/lib/auth-client-messages";
import { sessionRoles, signInWith } from "@/lib/auth-client";
import type { Role } from "@/lib/domain";
import { displayPhone } from "@/lib/login-input";
import { clock, OTP_LENGTH } from "@/lib/otp-input";
import { readPending, resendLeft, writePending, type PendingOtp } from "@/lib/otp-pending";

/** Enter the 6-digit code (UI-SPEC §4.3). Needs a pending code request from /login; otherwise goes back there. */
export function OtpForm({ next }: { next: string | null }) {
  const t = useTranslations("otp");
  const tc = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<PendingOtp | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const p = readPending();
    if (p) setPending(p);
    else router.replace("/login");
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  if (!pending) return null;
  const left = resendLeft(pending.sentAt, now);
  const complete = code.replace(/\s/g, "").length === OTP_LENGTH;
  const text = (m: AuthMessage) => (m.key === "otp.wrong" ? tc(m.key, { n: m.n }) : tc(m.key));

  async function verify() {
    if (!pending || busy || !complete) return;
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      const r = await signInWith("phone-otp", {
        phone: pending.phone,
        code,
        ...(pending.name ? { name: pending.name } : {}),
        ...(pending.roles ? { roles: pending.roles.join(",") } : {}),
      });
      if (!r.ok) {
        setError(messageForSignIn(r.code, pending.mode));
        return;
      }
      writePending(null);
      const roles = (await sessionRoles()) as Role[];
      leaving = true;
      location.assign(
        postLoginPath(locale, roles, next, pending.mode === "signup" && !!pending.roles?.includes("owner")),
      );
    } catch {
      toast({ tone: "error", message: tc("errors.offlineSubmit") });
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  async function resend() {
    if (!pending || resending || left > 0) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: pending.phone }),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; devCode?: string };
      if (!res.ok) {
        setError(messageForApi(body.code));
        return;
      }
      const p = { ...pending, sentAt: Date.now() };
      writePending(p);
      setPending(p);
      setNow(p.sentAt);
      setCode("");
      toast({ tone: "success", message: t("resent") });
      if (body.devCode) toast({ tone: "info", message: tc("login.devCode", { code: body.devCode }) });
    } catch {
      toast({ tone: "error", message: tc("errors.offlineSubmit") });
    } finally {
      setResending(false);
    }
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="font-display text-[32px] font-bold leading-[38px]">{t("title")}</h1>
      <p>
        {t("sent", { phone: displayPhone(pending.phone) })}{" "}
        <Link
          href={`/login?mode=${pending.mode}`}
          className="font-bold text-link underline underline-offset-4"
        >
          {t("change")}
        </Link>
      </p>
      <OtpInput
        value={code}
        onChange={setCode}
        invalid={!!error}
        describedBy={error ? "otp-error" : undefined}
      />
      <div role="alert" id="otp-error" className="empty:hidden">
        {error && (
          <p className="rounded-control bg-danger-bg p-3 text-small font-bold text-danger">{text(error)}</p>
        )}
      </div>
      <Button type="submit" loading={busy} disabledReason={complete ? undefined : t("digits")}>
        {t("verify")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="self-center disabled:text-text-subtle disabled:no-underline"
        loading={resending}
        disabled={left > 0}
        onClick={() => {
          void resend();
        }}
      >
        {left > 0 ? t("resendIn", { time: clock(left) }) : t("resend")}
      </Button>
    </form>
  );
}
