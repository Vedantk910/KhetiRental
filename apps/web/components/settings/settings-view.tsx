"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type SyntheticEvent, type ReactNode } from "react";
import { useSessionState } from "@/lib/use-session-state";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/field";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { EmailChange } from "@/components/settings/email-change";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { signOutRequest } from "@/lib/auth-client";
import { THEME_KEY, type ThemeChoice } from "@/lib/theme";

type Props = {
  name: string;
  phone: string | null;
  email: string | null;
  hasPassword: boolean;
  renter: boolean;
  owner: boolean;
  admin: boolean;
};

const DELETE_WORD = "DELETE";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children}
    </Card>
  );
}

/** What the server said went wrong, in the person's language. */
function useApiError() {
  const te = useTranslations("errors.api");
  const tr = useTranslations("errors");
  return async (res: Response | null) => {
    if (!res) return tr("network");
    const j = (await res.json().catch(() => ({}))) as { code?: string; triesLeft?: number };
    return te((j.code ?? "internal") as "internal", { phone: "", n: j.triesLeft ?? 0 });
  };
}

const Alert = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
    {children}
  </p>
);

const send = (method: string, url: string, body: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(
    () => null,
  );

function Profile({
  name,
  phone,
  email,
  hasPassword,
}: Pick<Props, "name" | "phone" | "email" | "hasPassword">) {
  const t = useTranslations("settings");
  const tc = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const apiError = useApiError();
  const [value, setValue] = useSessionState("settings.name", name, { onlyAfterSwitch: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [change, setChange] = useState<"closed" | "ask" | "code">("closed");
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  const save = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await send("PATCH", "/api/me", { name: value });
    if (res?.ok) {
      toast({ tone: "success", message: t("saved") });
      router.refresh();
    } else setErr(await apiError(res));
    setBusy(false);
  };

  const sendCode = async () => {
    setBusy(true);
    setPhoneErr(null);
    const res = await send("POST", "/api/auth/otp", { phone: newPhone });
    if (res?.ok) {
      const body = (await res.json().catch(() => ({}))) as { devCode?: string };
      if (body.devCode) toast({ tone: "info", message: tc("login.devCode", { code: body.devCode }) });
      setChange("code");
    } else setPhoneErr(await apiError(res));
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    setPhoneErr(null);
    const res = await send("POST", "/api/me/phone", { phone: newPhone, code });
    if (res?.ok) {
      toast({ tone: "success", message: t("phoneChanged") });
      setChange("closed");
      setNewPhone("");
      setCode("");
      router.refresh();
    } else setPhoneErr(await apiError(res));
    setBusy(false);
  };

  return (
    <Section id="s-profile" title={t("profile")}>
      <form method="post" onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
        <Input
          label={t("name")}
          value={value}
          maxLength={80}
          autoComplete="name"
          error={err}
          onChange={(e) => {
            setValue(e.target.value);
          }}
        />
        <Button type="submit" loading={busy && change === "closed"} className="self-start">
          {t("save")}
        </Button>
      </form>
      <div className="flex flex-col gap-1">
        <p className="text-label">{t("phone")}</p>
        <p className="text-body">{phone ?? t("phoneNone")}</p>
        {change === "closed" && (
          <Button
            variant="secondary"
            size="md"
            className="mt-2 self-start"
            onClick={() => {
              setChange("ask");
            }}
          >
            {t("changePhone")}
          </Button>
        )}
      </div>
      {change !== "closed" && (
        <div className="flex flex-col gap-3">
          <Input
            label={t("newPhone")}
            prefix="+91"
            inputMode="tel"
            autoComplete="tel-national"
            value={newPhone}
            disabled={change === "code"}
            error={change === "ask" ? phoneErr : null}
            onChange={(e) => {
              setNewPhone(e.target.value);
            }}
          />
          {change === "ask" ? (
            <Button className="self-start" loading={busy} onClick={() => void sendCode()}>
              {t("sendCode")}
            </Button>
          ) : (
            <>
              <Input
                label={t("code")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                hint={t("codeSent", { phone: `+91 ${newPhone}` })}
                value={code}
                error={phoneErr}
                onChange={(e) => {
                  setCode(e.target.value);
                }}
              />
              <Button className="self-start" loading={busy} onClick={() => void verify()}>
                {t("verify")}
              </Button>
            </>
          )}
        </div>
      )}
      <EmailChange email={email} hasPassword={hasPassword} />
    </Section>
  );
}

function Roles({ renter: r0, owner: o0 }: Pick<Props, "renter" | "owner">) {
  const t = useTranslations("settings");
  const apiError = useApiError();
  const [roles, setRoles] = useState({ renter: r0, owner: o0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const flip = async (key: "renter" | "owner") => {
    const next = { ...roles, [key]: !roles[key] };
    if (!next.renter && !next.owner) {
      setErr(t("needOne"));
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await send("PUT", "/api/me/roles", next);
    if (res?.ok) {
      setRoles(next);
      // The tab bar and header learn the new roles from the next page load.
      window.location.reload();
    } else setErr(await apiError(res));
    setBusy(false);
  };

  return (
    <Section id="s-roles" title={t("roles")}>
      {(["renter", "owner"] as const).map((key) => (
        <label key={key} className="flex min-h-tap-lg cursor-pointer items-center gap-3 text-body">
          <input
            type="checkbox"
            role="switch"
            className="h-6 w-6 shrink-0 accent-[rgb(var(--action))]"
            checked={roles[key]}
            disabled={busy}
            onChange={() => void flip(key)}
          />
          {t(key === "renter" ? "rent" : "own")}
        </label>
      ))}
      {err && <Alert>{err}</Alert>}
      {roles.owner && (
        <ButtonLink href="/owner/machines/new" variant="secondary" size="md" className="self-start">
          {t("ownerCta")}
        </ButtonLink>
      )}
    </Section>
  );
}

function Appearance() {
  const t = useTranslations("settings");
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark") setChoice(v);
    } catch {
      // storage blocked: stay on the phone's setting
    }
  }, []);
  const pick = (v: string) => {
    const c = v as ThemeChoice;
    setChoice(c);
    try {
      if (c === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, c);
    } catch {
      // the choice still applies to this page view
    }
    if (c === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = c;
  };
  return (
    <Section id="s-look" title={t("appearance")}>
      <ChipGroup
        label={t("appearance")}
        value={choice}
        onChange={pick}
        options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: t(v) }))}
      />
    </Section>
  );
}

function DeleteAccount({ admin }: { admin: boolean }) {
  const t = useTranslations("settings");
  const tcm = useTranslations("common");
  const locale = useLocale();
  const apiError = useApiError();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const remove = async () => {
    setBusy(true);
    setErr(null);
    const res = await send("DELETE", "/api/me", { confirm: DELETE_WORD });
    if (res?.ok) setDone(true);
    else setErr(await apiError(res));
    setBusy(false);
  };

  return (
    <Section id="s-delete" title={t("deleteTitle")}>
      <p className="text-body text-text-muted">{t("deleteBody")}</p>
      {admin ? (
        <p className="text-small text-text-subtle">{t("deleteAdmin")}</p>
      ) : (
        <Button
          variant="danger-outline"
          className="self-start"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t("deleteGo")}
        </Button>
      )}
      {open && (
        <Sheet
          open
          busy={busy}
          title={t("deleteAsk")}
          onClose={() => {
            if (done) window.location.assign(`/${locale}`);
            else setOpen(false);
          }}
        >
          {done ? (
            <div className="flex flex-col gap-4">
              <p role="status" className="text-body">
                {t("deleted")}
              </p>
              <a
                href={`/${locale}`}
                className="inline-flex min-h-tap-lg items-center justify-center rounded-control bg-action px-6 text-body font-bold text-action-on"
              >
                {tcm("goHome")}
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-body">{t("deleteBody")}</p>
              <Input
                label={t("deleteType", { word: DELETE_WORD })}
                value={typed}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-autofocus
                onChange={(e) => {
                  setTyped(e.target.value);
                }}
              />
              {err && <Alert>{err}</Alert>}
              <Button
                variant="danger-outline"
                loading={busy}
                disabledReason={typed === DELETE_WORD ? undefined : t("deleteType", { word: DELETE_WORD })}
                onClick={() => void remove()}
              >
                {t("deleteGo")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                }}
              >
                {t("deleteKeep")}
              </Button>
            </div>
          )}
        </Sheet>
      )}
    </Section>
  );
}

export function SettingsView(props: Props) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [leaving, setLeaving] = useState(false);
  const logout = async () => {
    setLeaving(true);
    try {
      await signOutRequest();
    } finally {
      window.location.assign(`/${locale}`);
    }
  };
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-h1">{t("title")}</h1>
      <Section id="s-lang" title={t("language")}>
        <LanguageSwitch name="settings" className="self-start" />
      </Section>
      <Profile name={props.name} phone={props.phone} email={props.email} hasPassword={props.hasPassword} />
      <Roles renter={props.renter} owner={props.owner} />
      <Appearance />
      <Section id="s-notif" title={t("notifs")}>
        <p className="text-body">{t("notifsNote")}</p>
        <label className="flex min-h-tap items-center gap-3 text-body text-text-subtle">
          <input type="checkbox" disabled className="h-6 w-6" />
          {t("sms")}
        </label>
      </Section>
      <Button variant="secondary" loading={leaving} onClick={() => void logout()}>
        {t("logout")}
      </Button>
      <DeleteAccount admin={props.admin} />
    </div>
  );
}
