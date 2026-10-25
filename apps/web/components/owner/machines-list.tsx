"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { formatRupees } from "@/lib/format";

export interface MyMachine {
  id: string;
  name: string;
  priceUnit: "hour" | "acre" | "day";
  priceRupees: number;
  active: boolean;
  rcStatus: "none" | "pending" | "checked" | "rejected";
}

function Row({ m }: { m: MyMachine }) {
  const t = useTranslations("owner");
  const tu = useTranslations("units");
  const te = useTranslations("errors.api");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (req: () => Promise<Response>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await req();
      if (!r.ok && r.status !== 204) {
        const j = (await r.json().catch(() => ({}))) as { code?: string };
        setError(te(j.code === "has_bookings" ? "has_bookings" : "internal", { phone: "" }));
        setBusy(false);
        return;
      }
      toast({ tone: "success", message: done });
      setOpen(false);
      setConfirm(false);
      router.refresh();
    } catch {
      setError(te("internal", { phone: "" }));
    }
    setBusy(false);
  };
  const close = () => {
    setOpen(false);
    setConfirm(false);
    setError(null);
  };

  return (
    <Card as="li" className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-bold">{m.name}</p>
          <p className="text-small text-text-muted">
            {t("perLive", {
              price: formatRupees(m.priceRupees * 100, locale),
              unit: tu(m.priceUnit),
              state: m.active ? t("live") : t("paused"),
            })}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ButtonLink variant="secondary" size="md" href={`/owner/machines/${m.id}/edit`}>
            {t("edit")}
          </ButtonLink>
          <Button
            variant="secondary"
            size="md"
            aria-label={t("more", { name: m.name })}
            onClick={() => {
              setOpen(true);
            }}
          >
            ⋯
          </Button>
        </div>
      </div>
      <Badge
        variant={m.rcStatus === "checked" ? "confirmed" : m.rcStatus === "pending" ? "waiting" : "neutral"}
        className="self-start"
      >
        {t(`rc.${m.rcStatus}`)}
      </Badge>
      {open && (
        <Sheet open busy={busy} title={m.name} onClose={close}>
          <div className="flex flex-col gap-3">
            {confirm ? (
              <>
                <h3 className="text-h3">{t("deleteTitle", { name: m.name })}</h3>
                <p className="text-body">{t("deleteBody")}</p>
                {error && (
                  <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
                    {error}
                  </p>
                )}
                <Button
                  variant="danger-outline"
                  loading={busy}
                  onClick={() =>
                    void run(
                      () => fetch(`/api/owner/machines/${m.id}`, { method: "DELETE" }),
                      t("deletedToast", { name: m.name }),
                    )
                  }
                >
                  {t("deleteYes")}
                </Button>
                <Button variant="secondary" onClick={close}>
                  {t("deleteKeep")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    void run(
                      () =>
                        fetch(`/api/owner/machines/${m.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ active: !m.active }),
                        }),
                      m.active ? t("pausedToast", { name: m.name }) : t("resumedToast", { name: m.name }),
                    )
                  }
                >
                  {m.active ? t("pause") : t("resume")}
                </Button>
                <Button
                  variant="danger-outline"
                  onClick={() => {
                    setConfirm(true);
                  }}
                >
                  {t("delete")}
                </Button>
                {error && (
                  <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </Sheet>
      )}
    </Card>
  );
}

export function MachinesList({ items }: { items: MyMachine[] }) {
  const t = useTranslations("owner");
  return (
    <section id="machines" aria-labelledby="mm-h" className="scroll-mt-20 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mm-h" className="text-h2">
          {t("machines", { n: items.length })}
        </h2>
        <Link
          href="/owner/machines/new"
          className="inline-flex min-h-tap items-center text-label text-link underline underline-offset-4"
        >
          {t("add")}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={t("noMachines")}
          actions={<ButtonLink href="/owner/machines/new">{t("listFirst")}</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
