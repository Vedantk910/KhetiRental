"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import type { adminOverview } from "@/server/admin";

type Overview = Awaited<ReturnType<typeof adminOverview>>;
type User = { id: string; name: string | null; email: string | null; phone: string | null; roles: string[] };
const ROLES = ["renter", "owner", "admin"] as const;

/** Sends a change and reports it with the same toast everywhere in this page. */
function useSend() {
  const t = useTranslations("admin");
  const toast = useToast();
  const router = useRouter();
  return async (url: string, method: string, body: unknown) => {
    try {
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      toast({ tone: "success", message: t("saved") });
      router.refresh();
      return true;
    } catch {
      toast({ tone: "error", message: t("failed") });
      return false;
    }
  };
}

function RcRow({ r }: { r: Overview["rc"][number] }) {
  const t = useTranslations("admin");
  const send = useSend();
  const [busy, setBusy] = useState(false);
  const decide = async (decision: "checked" | "rejected") => {
    setBusy(true);
    await send(`/api/admin/machines/${r.machineId}/rc`, "POST", { decision });
    setBusy(false);
  };
  return (
    <Card as="li" className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a href={r.rcUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 self-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- our own upload route */}
        <img
          src={r.rcUrl}
          alt={t("rcPhoto", { name: r.name })}
          className="h-[120px] w-[160px] rounded-control border border-border-subtle object-cover"
        />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body font-bold">{r.name}</p>
        <p className="text-small text-text-muted">{t("ownerLine", { owner: r.owner ?? "" })}</p>
        <a
          href={r.rcUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-tap items-center text-link underline underline-offset-4"
        >
          {t("rcOpen")}
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => void decide("checked")}>
          {t("approve")}
        </Button>
        <Button size="md" variant="danger-outline" loading={busy} onClick={() => void decide("rejected")}>
          {t("reject")}
        </Button>
      </div>
    </Card>
  );
}

function ProblemRow({ p }: { p: Overview["problems"][number] }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const send = useSend();
  const [note, setNote] = useState(p.note ?? "");
  const [busy, setBusy] = useState(false);
  const resolved = p.status === "resolved";
  const when = new Intl.DateTimeFormat(`${locale}-IN`, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(p.createdAt));
  const save = async (status: "open" | "resolved") => {
    setBusy(true);
    await send(`/api/admin/problems/${p.id}`, "PATCH", { status, note });
    setBusy(false);
  };
  return (
    <Card as="li" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-bold">
          {p.code} · {t(`types.${p.type as "other"}`)}
        </p>
        <Badge variant={resolved ? "confirmed" : "waiting"}>{resolved ? t("resolved") : t("open")}</Badge>
      </div>
      <p className="text-small text-text-muted">
        {t("reportedBy", { name: p.reporter ?? "" })} · {when}
      </p>
      {p.text && <p className="whitespace-pre-wrap break-words text-body">{p.text}</p>}
      {p.photos.length > 0 && (
        <ul aria-label={t("photosLabel")} className="flex flex-wrap gap-2">
          {p.photos.map((u, i) => (
            <li key={u}>
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-tap items-center text-link underline underline-offset-4"
              >
                {t("photoN", { n: i + 1 })}
              </a>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        label={t("note1")}
        maxLength={1000}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="md"
          variant="secondary"
          loading={busy}
          onClick={() => void save(p.status as "open" | "resolved")}
        >
          {t("saveNote")}
        </Button>
        <Button loading={busy} onClick={() => void save(resolved ? "open" : "resolved")}>
          {resolved ? t("reopen") : t("resolve")}
        </Button>
      </div>
    </Card>
  );
}

function UserRow({ u }: { u: User }) {
  const t = useTranslations("admin");
  const send = useSend();
  const [roles, setRoles] = useState(u.roles);
  const label = u.name || u.email || u.phone || u.id;
  return (
    <Card as="li" className="flex flex-col gap-2">
      <p className="text-body font-bold">{label}</p>
      <p className="break-words text-small text-text-muted">
        {[u.email, u.phone].filter(Boolean).join(" · ")}
      </p>
      <ChipGroup
        multiple
        label={t("rolesOf", { name: label })}
        value={roles}
        onChange={(v) => {
          if (v.length === 0) return;
          const prev = roles;
          setRoles(v);
          void send(`/api/admin/users/${u.id}`, "PATCH", { roles: v }).then((ok) => {
            if (!ok) setRoles(prev);
          });
        }}
        options={ROLES.map((r) => ({
          value: r,
          label: t(`role${r[0].toUpperCase()}${r.slice(1)}` as "roleOwner"),
        }))}
      />
    </Card>
  );
}

/** The demo admin page (UI-SPEC §4.20): plain tables, same tokens. */
export function AdminPanel({ data }: { data: Overview }) {
  const t = useTranslations("admin");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[] | null>(null);
  const search = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q.trim())}`);
    setUsers(r.ok ? ((await r.json()) as { items: User[] }).items : []);
  };
  return (
    <div className="mx-auto flex max-w-app flex-col gap-8 px-4 py-4 pb-8 sm:px-6">
      <div>
        <h1 className="text-h1">{t("title")}</h1>
        <p className="text-small text-text-muted">{t("note")}</p>
      </div>
      <section aria-labelledby="rc-h" className="flex flex-col gap-3">
        <h2 id="rc-h" className="text-h2">
          {t("rc")}
        </h2>
        {data.rc.length === 0 ? (
          <p className="text-body text-text-muted">{t("rcEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.rc.map((r) => (
              <RcRow key={r.machineId} r={r} />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="pr-h" className="flex flex-col gap-3">
        <h2 id="pr-h" className="text-h2">
          {t("problems")}
        </h2>
        {data.problems.length === 0 ? (
          <p className="text-body text-text-muted">{t("problemsEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.problems.map((p) => (
              <ProblemRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="us-h" className="flex flex-col gap-3">
        <h2 id="us-h" className="text-h2">
          {t("users")}
        </h2>
        <form onSubmit={(e) => void search(e)} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label={t("search")}
              maxLength={60}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("searchGo")}
          </Button>
        </form>
        {users &&
          (users.length === 0 ? (
            <p className="text-body text-text-muted">{t("noUsers")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {users.map((u) => (
                <UserRow key={u.id} u={u} />
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
