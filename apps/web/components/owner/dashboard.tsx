import { getLocale, getTranslations } from "next-intl/server";
import type { BookingView } from "@/components/rent/booking-detail";
import { formatRupees } from "@/lib/format";
import { MachinesList, type MyMachine } from "./machines-list";
import { OwnerCalendar, type CalDay } from "./calendar";
import { RequestCard } from "./request-card";

const tile = "flex flex-col rounded-control bg-[rgb(var(--neel-800))] p-[10px]";

/** The owner's home (UI-SPEC §4.12): earnings, new requests, calendar, my machines. */
export async function Dashboard({
  name,
  earnings,
  requests,
  machines,
  today,
  calendar,
}: {
  name: string;
  earnings: { monthPaise: number; paidPaise: number; comingPaise: number };
  requests: BookingView[];
  machines: MyMachine[];
  today: string;
  calendar: CalDay[];
}) {
  const t = await getTranslations("owner");
  const locale = await getLocale();
  const money = (p: number) => formatRupees(p, locale);
  return (
    <div>
      <section aria-labelledby="hero-h" className="bg-[rgb(var(--neel-700))] px-4 py-4 text-white sm:px-6">
        <div className="mx-auto flex max-w-app flex-col gap-3">
          <h1 id="hero-h" className="text-h2">
            {t("hello", { name })}
          </h1>
          <dl className="grid grid-cols-3 gap-2">
            <div className={tile}>
              <dt className="text-caption text-[rgb(var(--neel-100))]">{t("month")}</dt>
              <dd className="text-h3 tabular-nums">{money(earnings.monthPaise)}</dd>
            </div>
            <div className={tile}>
              <dt className="text-caption text-[rgb(var(--neel-100))]">{t("paid")}</dt>
              <dd className="text-h3 tabular-nums">{money(earnings.paidPaise)}</dd>
            </div>
            <div className={tile}>
              <dt className="text-caption text-[rgb(var(--neel-100))]">{t("coming")}</dt>
              <dd className="text-h3 tabular-nums text-[rgb(var(--sarson-300))]">
                {money(earnings.comingPaise)}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <div className="mx-auto grid max-w-app gap-6 px-4 py-4 pb-8 sm:px-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="req-h" className="flex flex-col gap-3">
            <h2 id="req-h" className="text-h2">
              {t("requests", { n: requests.length })}
            </h2>
            {requests.length === 0 ? (
              <p className="text-body text-text-muted">{t("noRequests")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {requests.map((b) => (
                  <RequestCard key={b.id} b={b} />
                ))}
              </ul>
            )}
          </section>
          <MachinesList items={machines} />
        </div>
        {machines.length > 0 && (
          <OwnerCalendar
            machines={machines.map((m) => ({ id: m.id, name: m.name }))}
            today={today}
            initialDays={calendar}
          />
        )}
      </div>
    </div>
  );
}
