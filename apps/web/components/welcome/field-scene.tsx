import type { CSSProperties } from "react";
import { LAP_SECONDS, SHOW_TRACTOR, SKY, TIME_OF_DAY } from "@/config/welcome";
import { cn } from "@/lib/utils";

/** Positions are in units of 1/844 of the hero's height (`--u`), as drawn in design/Main.dc.html. */
const at = (n: number) => `calc(var(--u) * ${n})`;
const STALKS = Array.from({ length: 16 }, (_, i) => ({ h: 18 + ((i * 7) % 14), delay: -(i % 5) * 0.4 }));

/**
 * The live field (UI-SPEC §4.1.2): SVG plus CSS keyframes, no canvas and no script loop.
 * Must sit inside a `.kr-hero` box. `still` freezes it into the poster frame.
 */
export function FieldScene({ still = false, className }: { still?: boolean; className?: string }) {
  const s = SKY[TIME_OF_DAY];
  return (
    <div
      aria-hidden="true"
      className={cn("kr-scene absolute inset-0 overflow-hidden", still && "kr-still", className)}
      style={{ "--lap": `${LAP_SECONDS}s` } as CSSProperties}
    >
      {/* sky, hills and soil stretch with the screen; things that must keep their shape are drawn below */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 844" preserveAspectRatio="none">
        <rect width="390" height="844" fill={s.sky} />
        <path d="M0 330 C70 290 140 300 210 320 S330 290 390 305 V420 H0 Z" fill={s.hill1} />
        <path d="M0 360 C90 335 170 350 260 345 S360 330 390 340 V440 H0 Z" fill={s.hill2} />
        <rect x="0" y="400" width="390" height="444" fill="#C9A86A" />
        <path
          d="M0 440 H390 M0 480 H390 M0 525 H390 M0 575 H390 M0 630 H390 M0 690 H390"
          stroke="#B08A4C"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <svg
        viewBox="0 0 76 76"
        className="absolute left-[77%] overflow-visible"
        style={{ top: at(s.sunY - 38), width: at(76), height: at(76), marginLeft: at(-38) }}
      >
        <circle className="kr-sun" cx="38" cy="38" r="38" fill={s.sun} />
      </svg>

      <svg
        viewBox="0 0 100 40"
        className="absolute left-0 overflow-visible"
        style={{ top: at(50), width: at(100), height: at(40) }}
      >
        <g className="kr-cloud" style={{ animationDuration: "38s" }}>
          <ellipse cx="48" cy="24" rx="44" ry="16" fill="#fff" opacity="0.85" />
          <ellipse cx="78" cy="14" rx="30" ry="14" fill="#fff" opacity="0.85" />
        </g>
      </svg>
      <svg
        viewBox="0 0 100 40"
        className="absolute left-0 overflow-visible lg:hidden"
        style={{ top: at(262), width: at(100), height: at(40) }}
      >
        <g className="kr-cloud" style={{ animationDuration: "55s", animationDelay: "-20s" }}>
          <ellipse cx="44" cy="22" rx="40" ry="14" fill="#fff" opacity="0.7" />
          <ellipse cx="70" cy="14" rx="24" ry="11" fill="#fff" opacity="0.7" />
        </g>
      </svg>

      <div
        className="absolute inset-x-0 flex items-end justify-around"
        style={{ top: at(404), height: at(34) }}
      >
        {STALKS.map((c, i) => (
          <span
            key={i}
            className="kr-sway block w-[6px] rounded-t-[3px] bg-[#4E7A2E]"
            style={{ height: at(c.h), animationDelay: `${c.delay}s` }}
          />
        ))}
      </div>

      <div
        className="kr-plough1 absolute inset-x-0 rounded-[4px] bg-[#6B4A26]"
        style={{ top: at(500), height: at(28) }}
      />
      <div
        className="kr-plough2 absolute inset-x-0 rounded-[4px] bg-[#6B4A26]"
        style={{ top: at(570), height: at(28) }}
      />

      {(SHOW_TRACTOR as boolean) && (
        <div className="kr-drive absolute left-0" style={{ top: at(420), width: at(170), height: at(110) }}>
          <svg viewBox="0 0 170 110" className="h-full w-full">
            <circle className="kr-puff" cx="96" cy="14" r="7" fill="#CFC4B4" />
            <circle
              className="kr-puff"
              cx="96"
              cy="14"
              r="6"
              fill="#CFC4B4"
              style={{ animationDelay: ".6s" }}
            />
            <g className="kr-body">
              <rect x="20" y="66" width="34" height="10" rx="2" fill="#483F37" />
              <rect x="54" y="48" width="86" height="30" rx="6" fill="#223585" />
              <path
                d="M88 48 V20 H124 L132 48"
                fill="#FFD45C"
                stroke="#13100D"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <rect x="92" y="18" width="5" height="18" fill="#13100D" />
            </g>
            <g className="kr-wheel">
              <circle cx="76" cy="80" r="26" fill="#13100D" />
              <circle cx="76" cy="80" r="10" fill="#FBC02D" />
              <path d="M76 56 V104 M52 80 H100" stroke="#483F37" strokeWidth="4" />
            </g>
            <g className="kr-wheel">
              <circle cx="138" cy="90" r="16" fill="#13100D" />
              <circle cx="138" cy="90" r="6" fill="#FBC02D" />
              <path d="M138 74 V106 M122 90 H154" stroke="#483F37" strokeWidth="3" />
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
