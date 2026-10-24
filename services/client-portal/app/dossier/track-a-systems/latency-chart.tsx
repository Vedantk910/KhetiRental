"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LOAD_TEST_RUNS } from "@/lib/evidence";

const ms = (v: number) => (v >= 10 ? `${Math.round(v).toLocaleString("en-IN")} ms` : `${v} ms`);

// Log scale: the runs span 1,770 ms to 0.66 ms, which a linear axis would flatten.
export function LatencyChart() {
  const data = LOAD_TEST_RUNS.map((r, i) => ({ name: `Run ${i + 1}`, p95: r.p95Ms, run: r.run }));
  return (
    // overflow-hidden: ResponsiveContainer keeps its old width for a frame after a resize.
    <div className="h-64 overflow-hidden" role="img" aria-label={`p95 latency by run: ${data.map((d) => `${d.name} ${ms(d.p95)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 24, right: 72, left: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--line)" />
          <XAxis type="number" scale="log" domain={[0.1, 5000]} ticks={[0.1, 1, 10, 100, 1000]} tickFormatter={ms}
            stroke="var(--muted)" tickLine={false} allowDataOverflow />
          <YAxis type="category" dataKey="name" stroke="var(--muted)" tickLine={false} axisLine={false} width={48} />
          <ReferenceLine x={10} stroke="var(--soil)" strokeDasharray="4 3"
            label={{ value: "p95 SLA 10 ms", position: "top", fill: "var(--soil)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "var(--line)", opacity: 0.4 }}
            formatter={(v) => [ms(Number(v)), "p95"]} labelFormatter={(_, p) => p?.[0]?.payload?.run ?? ""} />
          <Bar dataKey="p95" fill="var(--viz-1)" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="p95" position="right" formatter={(v: unknown) => ms(Number(v))} className="fill-[var(--fg)] text-xs" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
