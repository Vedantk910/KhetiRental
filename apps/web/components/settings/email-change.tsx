"use client";

import { useTranslations } from "next-intl";
import { useState, type SyntheticEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";

/** Settings → email: ask for a link to the new address. The change applies when that link is opened. */
export function EmailChange({ email, hasPassword }: { email: string | null; hasPassword: boolean }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; text: string } | null>(null);
  const [sent, setSent] = useState<{ email: string; devLink?: string } | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/me/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: value, ...(hasPassword ? { password } : {}) }),
    }).catch(() => null);
    if (res?.ok) {
      const body = (await res.json().catch(() => ({}))) as { devLink?: string };
      setSent({ email: value.trim(), devLink: body.devLink });
      setPassword("");
    } else {
      const j = (await res?.json().catch(() => ({}))) as { code?: string; field?: string } | undefined;
      setErr({
        field: j?.field,
        text: res ? te(`api.${j?.code ?? "internal"}` as "api.internal", { phone: "", n: 0 }) : te("network"),
      });
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="text-label">{t("email")}</p>
      <p className="break-words text-body">{email ?? t("emailNone")}</p>
      <p className="text-caption text-text-subtle">{t("emailNote")}</p>
      {!open && (
        <Button
          variant="secondary"
          size="md"
          className="mt-2 self-start"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t("emailChange")}
        </Button>
      )}
      {open &&
        (sent ? (
          <p role="status" className="mt-2 break-words rounded-control bg-surface-muted p-3 text-body">
            {t("emailSent", { email: sent.email })}
            {/* Without mail set up (dev and tests) the link is shown instead of sent. */}
            {sent.devLink && (
              <Link href={sent.devLink} className="mt-2 block break-all font-bold text-link underline">
                {sent.devLink}
              </Link>
            )}
          </p>
        ) : (
          <form
            method="post"
            noValidate
            onSubmit={(e) => void submit(e)}
            className="mt-2 flex flex-col gap-3"
          >
            <Input
              label={t("newEmail")}
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              value={value}
              error={err && err.field !== "password" ? err.text : null}
              onChange={(e) => {
                setValue(e.target.value);
              }}
            />
            {hasPassword && (
              <PasswordInput
                label={t("currentPassword")}
                autoComplete="current-password"
                maxLength={128}
                value={password}
                error={err?.field === "password" ? err.text : null}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
              />
            )}
            <Button type="submit" loading={busy} className="self-start">
              {t("emailSend")}
            </Button>
          </form>
        ))}
    </div>
  );
}
