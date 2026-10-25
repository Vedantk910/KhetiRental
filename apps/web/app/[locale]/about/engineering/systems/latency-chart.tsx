"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LOAD_TEST_RUNS } from "@/lib/evidence";

const ms = (v: number) => (v >= 10 ? `${Math.round(v).toLocaleString("en-IN")} ms` : `${v} ms`);

// Log scale: the runs span 1,770 ms to 0.66 ms, which a linear axis would flatten.
export function LatencyChart() {
  const data = LOAD_TEST_RUNS.map((r, i) => ({ name: `Run ${i + 1}`, p95: r.p95Ms, run: r.run }));
  return (
    // overflow-hidden: ResponsiveContainer keeps its old width for a frame after a resize.
    <div
      className="h-[256px] overflow-hidden"
      role="img"
      aria-label={`p95 latency by run: ${data.map((d) => `${d.name} ${ms(d.p95)}`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 24, right: 72, left: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="rgb(var(--border-subtle))" />
          <XAxis
            type="number"
            scale="log"
            domain={[0.1, 5000]}
            ticks={[0.1, 1, 10, 100, 1000]}
            tickFormatter={ms}
            stroke="rgb(var(--text-muted))"
            tickLine={false}
            allowDataOverflow
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="rgb(var(--text-muted))"
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <ReferenceLine
            x={10}
            stroke="rgb(var(--warning))"
            strokeDasharray="4 3"
            label={{ value: "p95 SLA 10 ms", position: "top", fill: "rgb(var(--warning))", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "rgb(var(--border-subtle))", opacity: 0.4 }}
            formatter={(v) => [ms(Number(v)), "p95"]}
            labelFormatter={(label: unknown) => data.find((d) => d.name === label)?.run ?? ""}
          />
          <Bar
            dataKey="p95"
            fill="rgb(var(--success))"
            barSize={18}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="p95"
              position="right"
              formatter={(v: unknown) => ms(Number(v))}
              className="fill-text text-caption"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
