"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { postLoginPath } from "@/lib/access";
import { messageForApi, messageForSignIn, type AuthMessage } from "@/lib/auth-client-messages";
import { sessionRoles, signInWith, startOAuth } from "@/lib/auth-client";
import {
  groupMobile,
  mobileDigits,
  passwordStrength,
  validateLogin,
  type Errors,
  type LoginValues,
} from "@/lib/login-input";
import { writePending } from "@/lib/otp-pending";
import { useSessionState } from "@/lib/use-session-state";
import type { Role } from "@/lib/domain";

export type GoogleMode = "mock" | "real" | null;
type Mode = LoginValues["mode"];

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgb(var(--action))" strokeWidth="2.5" />
      <path
        d="M12 11 H19 M18 11 A6 6 0 1 1 15.5 7"
        fill="none"
        stroke="rgb(var(--action))"
        strokeWidth="2.5"
      />
    </svg>
  );
}

/** Log in / Sign up (UI-SPEC §4.2): Google, mobile OTP or email + password. */
export function LoginForm({
  initialMode,
  initialRole,
  next,
  google,
  authFailed,
}: {
  initialMode: Mode;
  initialRole: "renter" | "owner";
  next: string | null;
  google: GoogleMode;
  authFailed: boolean;
}) {
  const t = useTranslations("login");
  const tc = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [method, setMethod] = useSessionState<"mobile" | "email">("login.method", "mobile");
  const [name, setName] = useSessionState("login.name", "");
  const [mobile, setMobile] = useSessionState("login.mobile", "");
  const [email, setEmail] = useSessionState("login.email", "");
  const [role, setRole] = useSessionState<"renter" | "owner">("login.role", initialRole);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<{
    field: "mobile" | "email" | "password" | "form";
    msg: AuthMessage | "exists";
  } | null>(authFailed ? { field: "form", msg: { key: "login.err.google" } } : null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const panelId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setMode = (m: Mode) => {
    setModeState(m);
    setErrors({});
    setApiError(null);
    const url = new URL(location.href);
    url.searchParams.set("mode", m);
    history.replaceState(history.state as unknown, "", url);
  };

  // After a failed submit, put the cursor on the first wrong field.
  useEffect(() => {
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, apiError]);

  const values: LoginValues = { mode, method, name, mobile, email, password };
  const msg = (m: AuthMessage | "exists") =>
    m === "exists" ? t("err.exists") : m.key === "otp.wrong" ? tc(m.key, { n: m.n }) : tc(m.key);

  async function finish(newOwnerSignup: boolean) {
    const roles = (await sessionRoles()) as Role[];
    location.assign(postLoginPath(locale, roles, next, newOwnerSignup));
  }

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (busy) return;
    const found = validateLogin(values);
    setErrors(found);
    setApiError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    let leaving = false;
    try {
      if (method === "mobile") leaving = await sendCode();
      else leaving = await emailAuth();
    } catch {
      toast({ tone: "error", message: tc("errors.offlineSubmit") });
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  async function sendCode() {
    const phone = `+91${mobileDigits(mobile)}`;
    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = (await res.json().catch(() => ({}))) as { code?: string; devCode?: string };
    if (!res.ok) {
      setApiError({ field: body.code === "rate_limited" ? "form" : "mobile", msg: messageForApi(body.code) });
      return false;
    }
    writePending({
      phone,
      mode,
      name: mode === "signup" ? name.trim() : undefined,
      roles: mode === "signup" ? [role] : undefined,
      sentAt: Date.now(),
    });
    if (body.devCode) toast({ tone: "info", message: t("devCode", { code: body.devCode }) });
    router.push(next ? `/login/otp?next=${encodeURIComponent(next)}` : "/login/otp");
    return true;
  }

  async function emailAuth() {
    if (mode === "signup") {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password, roles: [role] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        setApiError(
          body.code === "email_taken"
            ? { field: "email", msg: "exists" }
            : { field: body.code === "rate_limited" ? "form" : "email", msg: messageForApi(body.code) },
        );
        return false;
      }
    }
    const r = await signInWith("password", { email, password });
    if (!r.ok) {
      const m = messageForSignIn(r.code);
      setApiError({ field: m.key === "login.err.creds" ? "password" : "form", msg: m });
      return false;
    }
    await finish(mode === "signup" && role === "owner");
    return true;
  }

  async function withGoogle() {
    if (busy || !google) return;
    setBusy(true);
    setApiError(null);
    let leaving = false;
    try {
      if (google === "real") {
        await startOAuth("google", next ?? `/${locale}/rent`);
        leaving = true;
      } else {
        const r = await signInWith("mock-google");
        if (r.ok) {
          await finish(false);
          leaving = true;
        } else setApiError({ field: "form", msg: { key: "login.err.google" } });
      }
    } catch {
      toast({ tone: "error", message: tc("errors.offlineSubmit") });
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  const fieldError = (field: "mobile" | "email" | "password"): ReactNode => {
    if (apiError?.field === field)
      return (
        <>
          {msg(apiError.msg)}{" "}
          {apiError.msg === "exists" && (
            <button
              type="button"
              className="font-bold text-link underline"
              onClick={() => {
                setMode("login");
              }}
            >
              {t("tab.login")}
            </button>
          )}
        </>
      );
    const k = errors[field];
    if (!k) return undefined;
    if (k === "passwordShort") return mode === "signup" ? t("err.passwordShort") : t("err.passwordEmpty");
    return t(`err.${k}`);
  };

  const onTabKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - i;
    setMode(j === 0 ? "login" : "signup");
    tabRefs.current[j]?.focus();
  };

  const cta = method === "mobile" ? t("sendOtp") : mode === "signup" ? t("create") : t("doLogin");
  const strength = mode === "signup" && password ? passwordStrength(password) : null;
  const terms = tc("login.terms", { terms: "\u0000t", privacy: "\u0000p" }).split(/(\u0000[tp])/);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[32px] font-bold leading-[38px]">{t("welcome")}</h1>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="grid grid-cols-2 rounded-[12px] bg-surface-muted p-1"
      >
        {(["login", "signup"] as const).map((m, i) => (
          <button
            key={m}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${panelId}-${m}`}
            aria-selected={mode === m}
            aria-controls={panelId}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => {
              setMode(m);
            }}
            onKeyDown={(e) => {
              onTabKey(e, i);
            }}
            className={`min-h-[44px] rounded-[9px] text-label text-text ${mode === m ? "bg-surface" : "bg-transparent"}`}
          >
            {t(`tab.${m}`)}
          </button>
        ))}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${mode}`}>
        <form
          ref={form}
          noValidate
          onSubmit={(e) => {
            void submit(e);
          }}
          className="flex flex-col gap-4"
        >
          {google && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-[54px]"
              onClick={() => {
                void withGoogle();
              }}
            >
              <GoogleMark />
              {t("google")}
            </Button>
          )}
          {google && (
            <div
              aria-hidden="true"
              className="flex items-center gap-[10px] text-caption font-bold text-text-subtle"
            >
              <span className="h-px flex-1 bg-chip" />
              {t("or")}
              <span className="h-px flex-1 bg-chip" />
            </div>
          )}

          <ChipGroup
            label={t("methodLabel")}
            className="grid grid-cols-2"
            value={method}
            onChange={(v) => {
              setMethod(v as "mobile" | "email");
              setErrors({});
              setApiError(null);
            }}
            options={[
              { value: "mobile", label: t("mobile") },
              { value: "email", label: t("email") },
            ]}
          />

          {mode === "signup" && (
            <Input
              label={t("name")}
              name="name"
              autoComplete="name"
              maxLength={80}
              value={name}
              error={errors.name && t("err.name")}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          )}

          {method === "mobile" ? (
            <Input
              label={t("mobile")}
              name="tel-national"
              prefix="+91"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={groupMobile(mobileDigits(mobile))}
              hint={t("otpHint")}
              error={fieldError("mobile")}
              onChange={(e) => {
                setMobile(mobileDigits(e.target.value));
              }}
            />
          ) : (
            <>
              <Input
                label={t("emailAddr")}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                error={fieldError("email")}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
              />
              <PasswordInput
                label={t("password")}
                name="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                hint={
                  mode === "signup"
                    ? strength === "strong"
                      ? t("strength.strong")
                      : strength === "ok"
                        ? t("strength.ok")
                        : t("passwordHint")
                    : undefined
                }
                error={fieldError("password")}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
              />
              {mode === "login" && (
                <Link
                  href="/login/forgot"
                  className="-mt-2 flex min-h-tap items-center self-start font-bold text-link underline underline-offset-4"
                >
                  {t("forgot")}
                </Link>
              )}
            </>
          )}

          {mode === "signup" && (
            <div className="flex flex-col gap-2">
              <span className="text-label" id={`${panelId}-iwant`}>
                {t("iwant")}
              </span>
              <ChipGroup
                label={t("roleLabel")}
                className="grid grid-cols-2 [&>button]:min-h-tap-lg [&>button]:rounded-control"
                value={role}
                onChange={(v) => {
                  setRole(v as "renter" | "owner");
                }}
                options={[
                  { value: "renter", label: t("rent") },
                  { value: "owner", label: t("own") },
                ]}
              />
            </div>
          )}

          <div role="alert" className="empty:hidden">
            {apiError?.field === "form" && (
              <p className="rounded-control bg-danger-bg p-3 text-small font-bold text-danger">
                {msg(apiError.msg)}
              </p>
            )}
          </div>

          <Button type="submit" loading={busy}>
            {cta}
          </Button>
          <p className="text-center text-caption text-text-muted">
            {terms.map((part, i) =>
              part === "\u0000t" ? (
                <Link key={i} href="/terms" className="text-link underline underline-offset-4">
                  {tc("footer.terms")}
                </Link>
              ) : part === "\u0000p" ? (
                <Link key={i} href="/privacy" className="text-link underline underline-offset-4">
                  {tc("footer.privacy")}
                </Link>
              ) : (
                part
              ),
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
