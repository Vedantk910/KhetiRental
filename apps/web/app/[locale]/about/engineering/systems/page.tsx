import type { Metadata } from "next";
import { LOAD_TEST_RUNS } from "@/lib/evidence";
import { LatencyChart } from "./latency-chart";

export const metadata: Metadata = { title: "Systems dossier" };

// Axial hex coordinates within distance k of the origin (a k-ring).
function ring(k: number) {
  const cells: { q: number; r: number; d: number }[] = [];
  for (let q = -k; q <= k; q++)
    for (let r = Math.max(-k, -q - k); r <= Math.min(k, -q + k); r++)
      cells.push({ q, r, d: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) });
  return cells;
}

function hexPoints(cx: number, cy: number, s: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function H3Diagram() {
  const s = 26;
  const fill = ["rgb(var(--success))", "rgb(var(--info))", "rgb(var(--warning))"];
  return (
    <svg
      viewBox="-150 -125 300 250"
      role="img"
      aria-label="H3 k-ring: the farmer's cell, ring 1 (7 cells) and ring 2 (19 cells) fetched in one Redis pipeline"
      className="h-auto w-full max-w-sm"
    >
      {ring(2).map(({ q, r, d }) => (
        <polygon
          key={`${q},${r}`}
          points={hexPoints(s * Math.sqrt(3) * (q + r / 2), s * 1.5 * r, s - 1.5)}
          fill={fill[d]}
          fillOpacity={d === 0 ? 1 : 0.35}
          stroke="rgb(var(--surface))"
          strokeWidth={2}
        />
      ))}
      <circle r={5} fill="rgb(var(--surface))" />
      <text x={-146} y={118} className="fill-text-muted text-[11px]">
        k = 2 → 19 cells → 19 HGETALL in one round trip
      </text>
    </svg>
  );
}

function FencingDiagram() {
  return (
    <svg
      viewBox="0 0 560 210"
      role="img"
      className="h-auto w-full"
      aria-label="Fencing token timeline: holder A pauses, B takes the lock with token 8 and writes, A resumes with token 7 and the database rejects it"
    >
      <g className="text-[12px]">
        <text x={0} y={46} className="fill-text font-bold">
          Holder A
        </text>
        <text x={0} y={126} className="fill-text font-bold">
          Holder B
        </text>
        <line x1={80} y1={40} x2={550} y2={40} stroke="rgb(var(--border-subtle))" />
        <line x1={80} y1={120} x2={550} y2={120} stroke="rgb(var(--border-subtle))" />

        <rect x={90} y={28} width={90} height={24} rx={4} fill="rgb(var(--success))" />
        <text x={135} y={44} textAnchor="middle" className="fill-white">
          lock, token 7
        </text>
        <rect
          x={185}
          y={28}
          width={150}
          height={24}
          rx={4}
          fill="none"
          stroke="rgb(var(--warning))"
          strokeDasharray="4 3"
        />
        <text x={260} y={44} textAnchor="middle" className="fill-warning">
          GC pause, lease expires
        </text>
        <rect x={340} y={28} width={200} height={24} rx={4} fill="none" stroke="rgb(var(--warning))" />
        <text x={440} y={44} textAnchor="middle" className="fill-warning">
          writes with 7 → 0 rows
        </text>

        <rect x={250} y={108} width={90} height={24} rx={4} fill="rgb(var(--info))" />
        <text x={295} y={124} textAnchor="middle" className="fill-white">
          lock, token 8
        </text>
        <rect x={345} y={108} width={100} height={24} rx={4} fill="rgb(var(--info))" fillOpacity={0.35} />
        <text x={395} y={124} textAnchor="middle" className="fill-text">
          write → row = 8
        </text>

        <text x={80} y={175} className="fill-text">
          UPDATE bookings SET …, fencing_token = $token
        </text>
        <text x={80} y={195} className="fill-text">
          WHERE booking_id = $id AND fencing_token &lt;= $token
        </text>
      </g>
    </svg>
  );
}

function SagaDiagram() {
  const steps = ["Reserve machine", "Authorise escrow (30 s SLA)", "Dispatch"];
  return (
    <svg
      viewBox="0 0 560 230"
      role="img"
      className="h-auto w-full"
      aria-label="Saga with transactional outbox: each step commits its state and its event in one Postgres transaction; a failure or late answer compensates once"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--text-muted))" />
        </marker>
      </defs>
      <g className="text-[12px]">
        {steps.map((s, i) => (
          <g key={s}>
            <rect
              x={10 + i * 185}
              y={20}
              width={165}
              height={44}
              rx={6}
              fill="rgb(var(--surface))"
              stroke="rgb(var(--success))"
              strokeWidth={2}
            />
            <text x={92 + i * 185} y={46} textAnchor="middle" className="fill-text">
              {s}
            </text>
            {i < 2 && (
              <line
                x1={175 + i * 185}
                y1={42}
                x2={193 + i * 185}
                y2={42}
                stroke="rgb(var(--text-muted))"
                markerEnd="url(#arrow)"
              />
            )}
          </g>
        ))}
        <line x1={277} y1={64} x2={277} y2={112} stroke="rgb(var(--warning))" markerEnd="url(#arrow)" />
        <text x={285} y={92} className="fill-warning">
          fails or answers late
        </text>
        <rect
          x={160}
          y={114}
          width={235}
          height={44}
          rx={6}
          fill="rgb(var(--surface))"
          stroke="rgb(var(--warning))"
          strokeWidth={2}
        />
        <text x={277} y={133} textAnchor="middle" className="fill-text">
          Compensate: guarded transition first,
        </text>
        <text x={277} y={149} textAnchor="middle" className="fill-text">
          then release machine + void escrow, once
        </text>
        <rect
          x={10}
          y={180}
          width={540}
          height={36}
          rx={6}
          fill="rgb(var(--info))"
          fillOpacity={0.15}
          stroke="rgb(var(--info))"
        />
        <text x={280} y={203} textAnchor="middle" className="fill-text">
          every step: UPDATE bookings + INSERT outbox_events in one transaction → publisher → Kafka
        </text>
      </g>
    </svg>
  );
}

const SECTIONS = [
  {
    title: "Matching: Uber H3 instead of PostGIS",
    diagram: <H3Diagram />,
    text: "A farmer's location becomes an H3 cell at resolution 8 (about 460 m across). Nearby machines are the ones indexed in the cells around it, so a search reads a fixed number of keys however many machines exist. Each cell is a single Redis hash holding the machines' position, horsepower and owner rating, so ranking needs no second lookup.",
  },
  {
    title: "Locking: Redlock with fencing tokens",
    diagram: <FencingDiagram />,
    text: "A lock in Redis can expire while its holder is paused. Every grant carries a token minted after the lock is won, as one more than the highest counter across the quorum, so it always increases even if a minority node forgets. The database accepts a write only if its token is at least the row's, so a paused holder's late write changes nothing.",
  },
  {
    title: "Bookings: a saga with a transactional outbox",
    diagram: <SagaDiagram />,
    text: "A booking touches inventory, the payment provider and dispatch, which can fail independently. Each step writes its new state and its event in the same Postgres transaction, so the two never disagree. If payment fails or answers after 30 seconds, the booking is compensated exactly once: the machine is released and the authorisation voided, however many times the event is redelivered.",
  },
];

export default function SystemsDossier() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-h1 tracking-tight">Systems dossier</h1>
      <p className="mt-3 text-body font-bold">
        In plain words: how the app finds a nearby machine quickly, and how it stops two people booking the
        same one.
      </p>
      <p className="mt-4 max-w-prose text-body text-text-muted">
        How KhetiRental finds a tractor in under 3 ms at harvest-surge load, keeps two farmers from booking
        the same machine, and never moves money without a matching record.
      </p>

      {SECTIONS.map((s) => (
        <section
          key={s.title}
          className="mt-12 grid items-center gap-6 border-t border-border-subtle pt-8 md:grid-cols-[1fr_1.1fr]"
        >
          <div>
            <h2 className="text-h2">{s.title}</h2>
            <p className="mt-3 text-text-muted">{s.text}</p>
          </div>
          <div className="rounded-card bg-surface p-4">{s.diagram}</div>
        </section>
      ))}

      <section className="mt-12 border-t border-border-subtle pt-8">
        <h2 className="text-h2">What each change bought at 5,000 concurrent users</h2>
        <p className="mt-2 max-w-prose text-text-muted">
          p95 latency of the search endpoint in k6, from the first working version to the shipped one. Runs 2
          and 3 use the same load profile, so the drop from 728 ms to 190 ms is the index change alone. The
          last run also meets the p99 target: 2.91 ms against 25 ms, with no failed requests.
        </p>
        <div className="mt-[20px] rounded-card bg-surface p-4">
          <LatencyChart />
        </div>
        <table className="mt-4 w-full text-left text-caption">
          <caption className="sr-only">Load-test iterations</caption>
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="py-2 font-bold">
                Run
              </th>
              <th scope="col" className="py-2 font-bold">
                Change
              </th>
              <th scope="col" className="py-2 text-right font-bold">
                p95
              </th>
            </tr>
          </thead>
          <tbody>
            {LOAD_TEST_RUNS.map((r, i) => (
              <tr key={r.run} className="border-t border-border-subtle">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{r.run}</td>
                <td className="py-2 text-right tabular-nums">{r.p95Ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
