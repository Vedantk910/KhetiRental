import Link from "next/link";
import { EVIDENCE } from "@/lib/evidence";

const DOSSIERS = [
  {
    href: "/dossier/track-a-systems",
    cta: "Open the systems dossier",
    what: "Distributed systems",
    body: "H3 spatial matching in Go and Redis, Redlock with fencing tokens, a saga with a transactional outbox, offline-first telemetry sync and the 5,000-user load test.",
  },
  {
    href: "/dossier/track-b-product",
    cta: "Open the product dossier",
    what: "Product, risk and pricing",
    body: "The PRD and API contracts, the 3-stage milestone escrow and its dispute rules, the risk audit, and the depreciation pricing model behind every rate.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Tractors for small farms, booked in milliseconds and paid for only by the verified hour.
        </h1>
        <p className="mt-5 max-w-prose text-lg text-muted">
          KhetiRental matches a farmer to a nearby machine, holds the money in a three-stage escrow and
          releases it only when the handover, the work and the return are proven by telematics.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/marketplace"
            className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-fg"
          >
            Try the marketplace
          </Link>
          <Link
            href="/architecture/h3-spatial"
            className="rounded-md border border-line px-4 py-2.5 font-semibold"
          >
            See the H3 sandbox
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <table className="w-full border-collapse text-left">
          <caption className="mb-3 text-left text-lg font-semibold">
            Evidence ledger
            <span className="block text-sm font-normal text-muted">
              Every number on this site comes from a file in the repository. Here are the headline ones.
            </span>
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Value</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(EVIDENCE).map((e) => (
              <tr key={e.label} className="border-t border-line align-baseline">
                <th scope="row" className="py-4 pr-4 font-normal">
                  <span className="block font-medium">{e.label}</span>
                  <span className="block text-sm text-muted">{e.note}</span>
                </th>
                <td className="whitespace-nowrap py-4 pr-4 text-3xl font-bold tabular-nums text-primary">
                  {e.value}
                </td>
                <td className="hidden py-4 text-sm text-muted sm:table-cell">
                  <code>{e.source}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-2">
        {DOSSIERS.map((t) => (
          <article key={t.href} className="flex flex-col border-l-4 border-primary bg-surface p-6">
            <h2 className="text-2xl font-semibold">{t.what}</h2>
            <p className="mt-3 flex-1 text-muted">{t.body}</p>
            <Link href={t.href} className="mt-5 font-semibold text-primary underline underline-offset-4">
              {t.cta}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
