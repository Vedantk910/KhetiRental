import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Architecture & ADRs | KhetiRental v2.0" };

const SERVICES = [
  { name: "matching-engine", tech: "Go, Uber H3, Redis", job: "Finds and ranks machines near a farmer from per-cell Redis hashes." },
  { name: "booking-orchestrator", tech: "Go, Redlock, Postgres outbox", job: "Runs each booking as a saga under a fenced lock; state and event commit together." },
  { name: "telemetry-gateway", tech: "Go, WebSocket, CRDT", job: "Syncs field telemetry over flaky 2G, keeps the full track, evaluates geofence and hour-meter rules." },
  { name: "client-portal", tech: "Next.js, TypeScript", job: "This site: marketplace, pricing, escrow and the H3 sandbox." },
];

const ADRS = [
  { id: "ADR-0001", title: "Uber H3 instead of PostGIS for matching", file: "docs/adr/0001-h3-vs-postgis.md" },
  { id: "ADR-0002", title: "A Kafka saga instead of two-phase commit", file: "docs/adr/0002-kafka-saga-vs-2pc.md" },
  { id: "ADR-0003", title: "Three-stage milestone escrow instead of upfront capture", file: "docs/adr/0003-3-stage-escrow.md" },
  { id: "ADR-0004", title: "Dynamic depreciation pricing instead of a flat tariff", file: "docs/adr/0004-dynamic-depreciation-pricing.md" },
];

export default function Architecture() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Architecture and decisions</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        Three Go services, a Postgres system of record with a transactional outbox, Redis for spatial search and locks,
        and this portal. The full C4 view is in <code>ARCHITECTURE.md</code>.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Services</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {SERVICES.map((s) => (
            <div key={s.name} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr]">
              <dt><code className="font-semibold">{s.name}</code><span className="block text-sm text-muted">{s.tech}</span></dt>
              <dd className="text-muted">{s.job}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4">
          See matching work in the <Link href="/architecture/h3-spatial" className="text-primary underline">H3 spatial sandbox</Link>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Architecture decision records</h2>
        <ul className="mt-4 space-y-3">
          {ADRS.map((a) => (
            <li key={a.id} className="bg-surface p-4">
              <p className="font-semibold">{a.id}: {a.title}</p>
              <p className="text-sm text-muted"><code>{a.file}</code></p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-muted">
          The reasoning behind each is walked through in the{" "}
          <Link href="/dossier/track-b-product" className="text-primary underline">product dossier</Link>.
        </p>
      </section>
    </div>
  );
}
