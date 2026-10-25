import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { hourlyRate, netHourlyToOwner, paybackYears } from "@/lib/pricing-engine";

export const metadata: Metadata = { title: "Product dossier" };

const ADRS = [
  {
    id: "ADR-0001",
    title: "Uber H3 instead of PostGIS for matching",
    file: "showcase/docs/adr/0001-h3-vs-postgis.md",
    decision: "Index machines by H3 cell in Redis; keep Postgres for bookings only.",
    why: "A radius search becomes a fixed number of key reads, so search speed doesn't depend on how many machines are listed or how busy the booking database is.",
    tradeoff: "A ring of hexagons over-covers a circle, so results are trimmed by true distance afterwards.",
  },
  {
    id: "ADR-0002",
    title: "A saga instead of a distributed transaction",
    file: "showcase/docs/adr/0002-kafka-saga-vs-2pc.md",
    decision: "Run bookings as a saga with a transactional outbox and fencing tokens.",
    why: "A slow payment provider must not freeze the whole marketplace in harvest week. A saga moves forward and undoes only what it did when a step fails.",
    tradeoff: "Bookings are eventually consistent, so the app has to show a pending state honestly.",
  },
  {
    id: "ADR-0003",
    title: "Milestone escrow instead of paying upfront",
    file: "showcase/docs/adr/0003-3-stage-escrow.md",
    decision: "Hold rental plus deposit; release only after handover, telematics window and return audit.",
    why: "Each side's money moves only when the other side's obligation is proven, which is the trust a broker never offered.",
    tradeoff: "Three gates cost operations effort and a little speed compared with charging at booking.",
  },
  {
    id: "ADR-0004",
    title: "Cost-based pricing instead of a flat tariff",
    file: "showcase/docs/adr/0004-dynamic-depreciation-pricing.md",
    decision: "Price each hour as market rate + wear recovery + diesel at cost.",
    why: "Every part of the price can be explained to a farmer and tuned on its own; the platform earns nothing on fuel, so its margin doesn't swing with diesel prices.",
    tradeoff: "Pricing needs live diesel, season and soil inputs.",
  },
];

const M101 = {
  hp: "45",
  ageYears: 5,
  acquisitionCostInr: 640_000,
  soil: "loam",
  season: "harvest_compressed",
} as const;
const TAKE_RATES = [0.12, 0.135, 0.15];
const HOURS = [250, 400, 620];

export default function ProductDossier() {
  const rate = hourlyRate(M101, 91);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-h1 tracking-tight">Product dossier</h1>
      <p className="mt-3 text-body font-bold">
        In plain words: why the app is built the way it is, what it costs an owner, and what we still
        don&apos;t know.
      </p>
      <p className="mt-4 max-w-prose text-body text-text-muted">
        The product, risk and pricing decisions behind KhetiRental, with the evidence for each and the
        questions that are still open.
      </p>

      <section className="mt-12 border-t border-border-subtle pt-8">
        <h2 className="text-h2">The problem in one paragraph</h2>
        <p className="mt-3 max-w-prose text-text-muted">
          About 86 % of India&apos;s farm holdings are under two hectares. Their owners need a tractor for a
          few hours, inside the same short sowing or harvest window as every neighbour, and today rent through
          brokers who set the price and guarantee nothing. Tractor owners, meanwhile, leave machines idle
          because renting to strangers is risky. KhetiRental makes the machine findable in milliseconds, makes
          the price explainable, and makes the money move only when the work is proven. The full case is in{" "}
          <code>showcase/docs/PRD.md</code>.
        </p>
      </section>

      <section className="mt-12 border-t border-border-subtle pt-8">
        <h2 className="text-h2">Four decisions</h2>
        <div className="mt-[20px] grid gap-[20px] md:grid-cols-2">
          {ADRS.map((a) => (
            <article key={a.id} className="bg-surface p-[20px]">
              <h3 className="font-bold">
                {a.id}: {a.title}
              </h3>
              <dl className="mt-3 space-y-2 text-caption">
                <div>
                  <dt className="font-bold">Decision</dt>
                  <dd className="text-text-muted">{a.decision}</dd>
                </div>
                <div>
                  <dt className="font-bold">Why</dt>
                  <dd className="text-text-muted">{a.why}</dd>
                </div>
                <div>
                  <dt className="font-bold">What it costs</dt>
                  <dd className="text-text-muted">{a.tradeoff}</dd>
                </div>
              </dl>
              <p className="mt-3 text-caption text-text-muted">
                <code>{a.file}</code>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-border-subtle pt-8">
        <h2 className="text-h2">Unit economics</h2>
        <p className="mt-3 max-w-prose text-text-muted">
          A 5-year-old 45 HP tractor worth ₹6.4 lakh, in loam during the harvest surge, rents at ₹
          {rate.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })} an hour: ₹{rate.base} market
          rate, ₹{rate.wear} wear recovery and ₹{rate.fuel} diesel at cost. The owner keeps that minus diesel
          and the platform fee. Years to pay back the tractor:
        </p>
        <table className="mt-[20px] w-full max-w-xl text-left">
          <caption className="sr-only">Owner payback in years by take-rate and rented hours per year</caption>
          <thead>
            <tr className="text-caption text-text-muted">
              <th scope="col" className="py-2 font-bold">
                Platform fee
              </th>
              {HOURS.map((h) => (
                <th key={h} scope="col" className="py-2 text-right font-bold">
                  {h} h / yr
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TAKE_RATES.map((t) => (
              <tr key={t} className="border-t border-border-subtle">
                <th scope="row" className="py-2 font-normal">
                  {(t * 100).toFixed(1)} %
                </th>
                {HOURS.map((h) => (
                  <td key={h} className="py-2 text-right tabular-nums">
                    {paybackYears(640_000, netHourlyToOwner(rate, t), h).toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 max-w-prose text-caption text-text-muted">
          Computed live by the same engine as the pricing page, which a test keeps identical to{" "}
          <code>showcase/analytics/pricing.py</code>. Harvest rates are the best case; blended across seasons
          the model gives 5.09 years at 250 hours and 2.05 at 620.
        </p>
      </section>

      <section className="mt-12 border-t border-border-subtle pt-8">
        <h2 className="text-h2">Escrow and the risk audit</h2>
        <p className="mt-3 max-w-prose text-text-muted">
          The renter pre-authorises the rental plus a security deposit of 15 % or a horsepower-tier floor,
          whichever is higher. Nine dispute rules decide what happens when a stage fails, from a geofence
          breach (more than 500 m beyond the parcel edge for a minute) to a breakdown or a rain delay. An
          audit of the first design found 19 vulnerabilities, two of them critical, and every one was
          reproduced as a failing test. Remediations 1–13 are fixed in code; 14–22 are in the contract, with
          the GPS-spoof, breakdown and weather rules specified but not yet built. Try the escrow on the{" "}
          <Link
            href="/about/engineering/escrow"
            className="inline-flex min-h-tap min-w-tap items-center text-link underline"
          >
            escrow page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
