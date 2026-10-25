import { BarList } from "@/components/engineering/bar-list";
import { LOAD_TEST_RUNS } from "@/lib/evidence";

const ms = (v: number) => (v >= 10 ? `${Math.round(v).toLocaleString("en-IN")} ms` : `${v} ms`);

export function LatencyChart() {
  return (
    <BarList
      label="p95 latency by run"
      scale="log"
      min={0.1}
      max={5000}
      bars={LOAD_TEST_RUNS.map((r, i) => ({
        label: `Run ${i + 1}`,
        value: r.p95Ms,
        text: ms(r.p95Ms),
        tone: r.p95Ms <= 10 ? "success" : "muted",
      }))}
    />
  );
}
