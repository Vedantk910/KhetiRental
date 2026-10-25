const TONE = { success: "bg-success", muted: "bg-text-muted", warning: "bg-warning" } as const;

export interface Bar {
  label: string;
  value: number;
  /** What is printed at the end of the bar. */
  text: string;
  tone: keyof typeof TONE;
}

/** Bar length as a percentage. Log scale: the runs span 1,770 ms to 0.66 ms, which a linear one would flatten. */
export function barPercent(value: number, max: number, scale: "linear" | "log", min = 0.1) {
  const p =
    scale === "log"
      ? (Math.log10(Math.max(value, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))
      : value / max;
  return Math.min(100, Math.max(0, p * 100));
}

/** Horizontal bars made of plain boxes (no chart library in the browser bundle), with the value written out. */
export function BarList({
  label,
  bars,
  max,
  min,
  scale = "linear",
}: {
  label: string;
  bars: Bar[];
  max: number;
  min?: number;
  scale?: "linear" | "log";
}) {
  return (
    <div role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${b.text}`).join(", ")}`}>
      <ul aria-hidden className="space-y-3">
        {bars.map((b) => (
          <li key={b.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-caption">
            <span className="text-text-muted">{b.label}</span>
            <span className="rounded-r block h-[18px] bg-border-subtle">
              <span
                data-bar
                className={`rounded-r block h-full ${TONE[b.tone]}`}
                style={{ inlineSize: `${barPercent(b.value, max, scale, min)}%` }}
              />
            </span>
            <span className="min-w-[5.5rem] text-right font-bold text-text">{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
