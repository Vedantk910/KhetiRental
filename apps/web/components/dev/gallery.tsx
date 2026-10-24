"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { JOBS, MACHINES, Pictogram, type JobName } from "@/components/pictograms/pictogram";
import { TabBar } from "@/components/shell/tab-bar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/field";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { PriceRow } from "@/components/ui/price-row";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { StickyCTA } from "@/components/ui/sticky-cta";
import { TileGroup } from "@/components/ui/tile";
import { useToast } from "@/components/ui/toast";
import { formatDateRange, formatRupees, toAsciiNumber } from "@/lib/format";
import { useSessionState } from "@/lib/use-session-state";

const VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "outline-dark",
  "danger-outline",
  "ghost",
  "pill-primary",
  "pill-accent",
  "pill-light",
];
const SUBMIT_MS = 2000;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-border-subtle pt-8">
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-caption text-text-subtle">{label}</p>
      {children}
    </div>
  );
}

function ThemeToggle({ label }: { label: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(
      document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
          window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }, []);
  return (
    <Button
      variant="secondary"
      size="md"
      aria-pressed={dark}
      onClick={() => {
        document.documentElement.dataset.theme = dark ? "light" : "dark";
        setDark(!dark);
      }}
    >
      {label}
    </Button>
  );
}

export function Gallery() {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const [mobile, setMobile] = useSessionState("dev.mobile", "");
  const [when, setWhen] = useState("week");
  const [jobs, setJobs] = useState<string[]>(["plough"]);
  const [job, setJob] = useState<JobName>("rotavate");
  const [acres, setAcres] = useState(2.5);
  const [sheet, setSheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sticky, setSticky] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const dates = formatDateRange(
    new Date("2026-11-02T00:00:00+05:30"),
    new Date("2026-11-04T00:00:00+05:30"),
    locale,
  );
  const price = formatRupees(71_000, locale);
  const rate = formatRupees(28_400, locale);
  const jobOptions = JOBS.map((j) => ({ value: j, label: t(`jobs.${j}`) }));

  const submit = () => {
    setSubmitting(true);
    timer.current = setTimeout(() => {
      setSubmitting(false);
      setSheet(false);
      toast({ tone: "success", message: t("status.cancelled") });
    }, SUBMIT_MS);
  };

  return (
    <div className="mx-auto flex max-w-app flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">{t("dev.title")}</h1>
        <p className="max-w-read text-text-muted">{t("dev.intro")}</p>
        <ThemeToggle label={t("dev.theme")} />
      </div>

      <Section id="s-buttons" title={t("dev.buttons")}>
        <div className="flex flex-wrap items-start gap-4">
          {VARIANTS.map((v) => (
            <State key={v} label={v}>
              <div className="flex flex-wrap gap-2">
                <Button variant={v}>{t("search.cta")}</Button>
                <Button variant={v} size="md">
                  {t("common.next")}
                </Button>
              </div>
            </State>
          ))}
          <State label={t("dev.loadingDemo")}>
            <Button loading>{t("pay.ctaOnline", { amount: price })}</Button>
          </State>
          <State label={t("dev.disabledDemo")}>
            <Button disabledReason={t("search.need")}>{t("search.cta")}</Button>
          </State>
          <State label="link">
            <ButtonLink href="/dev/ui" variant="secondary">
              {t("bookings.findOne")}
            </ButtonLink>
          </State>
        </div>
      </Section>

      <Section id="s-fields" title={t("dev.fields")}>
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label={t("login.mobile")}
            prefix="+91"
            inputMode="numeric"
            autoComplete="tel-national"
            hint={t("login.otpHint")}
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value);
            }}
          />
          <Input
            label={t("login.emailAddr")}
            type="email"
            error={t("login.err.creds")}
            defaultValue="ramesh@"
          />
          <Select label={t("dev.chips")} defaultValue="nearest">
            <option value="nearest">{t("results.sort.nearest")}</option>
            <option value="cheapest">{t("results.sort.cheapest")}</option>
            <option value="top">{t("results.sort.top")}</option>
          </Select>
          <Textarea label={t("problem.title")} hint={t("problem.sent")} />
        </div>
      </Section>

      <Section id="s-chips" title={t("dev.chips")}>
        <State label={t("search.when")}>
          <ChipGroup
            label={t("search.when")}
            options={["tomorrow", "week", "pick"].map((v) => ({
              value: v,
              label: t(`search.${v as "week"}`),
            }))}
            value={when}
            onChange={setWhen}
          />
        </State>
        <State label={t("dev.multi")}>
          <ChipGroup label={t("dev.multi")} multiple options={jobOptions} value={jobs} onChange={setJobs} />
        </State>
      </Section>

      <Section id="s-tiles" title={t("dev.tiles")}>
        <div className="max-w-[420px]">
          <TileGroup
            label={t("search.what")}
            options={JOBS.map((j) => ({
              value: j,
              label: t(`jobs.${j}`),
              icon: <Pictogram name={j} accent={j === job} />,
            }))}
            value={job}
            onChange={(v) => {
              setJob(v as JobName);
            }}
          />
        </div>
      </Section>

      <Section id="s-cards" title={t("dev.cards")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card as="article" variant="machine" aria-label="Swaraj 744 FE" className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="free">{t("results.freeChip", { dates })}</Badge>
              <Badge variant="sample" />
            </div>
            <h3 className="text-h3">Swaraj 744 FE</h3>
            <p className="text-small text-text-muted">{t("results.away", { km: 3, village: "Latur" })}</p>
            <p className="text-price tabular-nums">
              {rate} <span className="text-small font-normal text-text-subtle">{t("units.hour")}</span>
            </p>
            <ButtonLink href="/dev/ui">{t("results.book", { dates })}</ButtonLink>
          </Card>
          <Card as="article" variant="booking" aria-label="KR-4821" className="flex flex-col gap-2">
            <Badge variant="waiting">{t("status.requested")}</Badge>
            <h3 className="text-h3">{t("bookings.sent", { owner: "Ramesh K." })}</h3>
            <p className="text-small text-text-muted">{t("bookings.code", { code: "KR-4821" })}</p>
          </Card>
          <Card
            as="article"
            variant="request"
            aria-label={t("owner.requests", { n: 1 })}
            className="flex flex-col gap-2"
          >
            <h3 className="text-h3">{t("owner.requests", { n: 1 })}</h3>
            <p className="text-small text-warning">{t("owner.replyIn", { time: "42 min" })}</p>
            <div className="flex gap-2">
              <Button size="md">{t("owner.accept")}</Button>
              <Button size="md" variant="danger-outline">
                {t("owner.decline")}
              </Button>
            </div>
          </Card>
          <Card as="article" variant="busy" aria-label={t("results.busy")} className="flex flex-col gap-2">
            <p className="text-caption font-bold text-text-subtle">{t("results.busy")}</p>
            <p className="text-small">{t("results.freeFrom", { date: "Thu 5 Nov" })}</p>
          </Card>
        </div>
      </Section>

      <Section id="s-sheet" title={t("dev.sheet")}>
        <p className="text-small text-text-muted">{t("dev.submitting")}</p>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setSheet(true);
            }}
          >
            {t("dev.openSheet")}
          </Button>
        </div>
        <Sheet
          open={sheet}
          busy={submitting}
          title={t("cancel.title")}
          onClose={() => {
            setSheet(false);
          }}
        >
          <div className="flex flex-col gap-3">
            <Button variant="danger-outline" loading={submitting} onClick={submit}>
              {t("cancel.yes")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!submitting) setSheet(false);
              }}
            >
              {t("cancel.keep")}
            </Button>
          </div>
        </Sheet>
      </Section>

      <Section id="s-sticky" title={t("dev.sticky")}>
        <div>
          <Button
            variant="secondary"
            aria-pressed={sticky}
            onClick={() => {
              setSticky(!sticky);
            }}
          >
            {t("dev.showSticky")}
          </Button>
        </div>
        <TabBar preview />
        {sticky && (
          <StickyCTA price={price} caption={t("detail.est", { what: t("search.acres", { n: 2.5 }) })}>
            <Button>{t("detail.book", { dates })}</Button>
          </StickyCTA>
        )}
      </Section>

      <Section id="s-stepper" title={t("dev.stepper")}>
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <span className="text-label">
            {t("search.size")} <span className="font-normal text-text-subtle">{t("search.optional")}</span>
          </span>
          <Stepper
            label={t("search.size")}
            value={acres}
            onChange={setAcres}
            min={0.5}
            max={50}
            step={0.5}
            decLabel={t("search.fewerAcres")}
            incLabel={t("search.moreAcres")}
          />
        </div>
        <p data-testid="acres" className="text-small text-text-muted">
          {t("search.acres", { n: acres })}
        </p>
      </Section>

      <Section id="s-badges" title={t("dev.badges")}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="free">{t("results.freeChip", { dates })}</Badge>
          <Badge variant="busy">{t("results.busy")}</Badge>
          <Badge variant="waiting">{t("status.requested")}</Badge>
          <Badge variant="confirmed">{t("status.confirmed")}</Badge>
          <Badge variant="info">{t("detail.rc")}</Badge>
          <Badge variant="neutral">{t("detail.reviews", { r: "4.6", n: 23 })}</Badge>
          <Badge variant="sample" />
        </div>
      </Section>

      <Section id="s-toasts" title={t("dev.toasts")}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              toast({ tone: "success", message: t("pay.success") });
            }}
          >
            {t("pay.success")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              toast({ tone: "info", message: t("problem.sent") });
            }}
          >
            {t("problem.sent")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              toast({ tone: "error", message: t("errors.network") });
            }}
          >
            {t("errors.network")}
          </Button>
        </div>
      </Section>

      <Section id="s-empty" title={t("dev.empty")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <EmptyState
              icon={<Pictogram name="tractor" />}
              title={t("bookings.empty")}
              body={t("notif.empty")}
              actions={<ButtonLink href="/dev/ui">{t("bookings.findOne")}</ButtonLink>}
            />
          </Card>
          <Card className="flex flex-col gap-3">
            <p className="sr-only">{t("common.loading")}</p>
            <Skeleton className="h-[180px] rounded-card" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </Card>
        </div>
      </Section>

      <Section id="s-prices" title={t("dev.prices")}>
        <div className="flex max-w-read flex-col gap-2">
          <PriceRow label={t("booking.rent", { qty: t("search.acres", { n: 2.5 }), rate })} value={price} />
          <PriceRow label={t("booking.diesel")} value={t("booking.included")} />
          <PriceRow
            label={
              <>
                {t("booking.deposit")}{" "}
                <span className="text-small text-text-subtle">{t("booking.depositNote")}</span>
              </>
            }
            value={formatRupees(50_000, locale)}
          />
          <PriceRow label={t("booking.youPay")} value={price} total />
        </div>
      </Section>

      <Section id="s-language" title={t("dev.language")}>
        <div className="flex flex-wrap gap-4">
          <LanguageSwitch name="gallery" />
          <LanguageSwitch name="gallery-tight" tight />
        </div>
      </Section>

      <Section id="s-pictograms" title={t("dev.pictograms")}>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ...JOBS.map((n) => [n, t(`jobs.${n}`)] as const),
            ...MACHINES.map((n) => [n, t(`machines.${n}`)] as const),
          ].map(([n, label]) => (
            <li key={n} className="flex flex-col items-center gap-2 text-center text-caption">
              <span className="flex gap-1">
                <Pictogram name={n} />
                <Pictogram name={n} accent />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="s-formats" title={t("dev.formats")}>
        <dl className="grid max-w-read grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body">
          <dt className="text-text-muted">formatRupees(71000)</dt>
          <dd className="tabular-nums">{price}</dd>
          <dt className="text-text-muted">formatRupees(1234567800)</dt>
          <dd className="tabular-nums">{formatRupees(1_234_567_800, locale)}</dd>
          <dt className="text-text-muted">formatDateRange</dt>
          <dd>{dates}</dd>
          <dt className="text-text-muted">toAsciiNumber(&quot;२,५&quot;)</dt>
          <dd className="tabular-nums">{toAsciiNumber("२,५")}</dd>
        </dl>
      </Section>
    </div>
  );
}
