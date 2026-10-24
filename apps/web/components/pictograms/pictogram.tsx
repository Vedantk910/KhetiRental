import type { ReactNode } from "react";

/* Job and machine pictograms (UI-SPEC §5.12): 32 px, 2 px stroke in currentColor, one optional mustard accent. */

export const JOBS = ["plough", "rotavate", "sow", "spray", "harvest", "transport"] as const;
export const MACHINES = [
  "tractor",
  "rotavator",
  "combine",
  "sprayer",
  "seedDrill",
  "trolley",
  "thresher",
  "baler",
] as const;
export type JobName = (typeof JOBS)[number];
export type MachineName = (typeof MACHINES)[number];
export type PictogramName = JobName | MachineName;

type Art = { lines: ReactNode; accent: ReactNode };

const ART: Record<PictogramName, Art> = {
  plough: {
    lines: (
      <>
        <path d="M4 8h20" />
        <path d="M10 8l4 12M17 8l4 12" />
        <path d="M3 26q4-3 8 0t9 0t9 0" />
      </>
    ),
    accent: <path d="M12 20h5l-2 3zM19 20h5l-2 3z" />,
  },
  rotavate: {
    lines: (
      <>
        <circle cx="16" cy="13" r="7" />
        <path d="M16 6v14M9 13h14M11 8l10 10M21 8L11 18" />
        <path d="M3 26h26" />
      </>
    ),
    accent: <circle cx="16" cy="13" r="2.5" />,
  },
  sow: {
    lines: (
      <>
        <path d="M16 28V15" />
        <path d="M16 19q-6 0-7-6q6 0 7 6zM16 16q6 0 7-6q-6 0-7 6z" />
        <path d="M6 28h20" />
      </>
    ),
    accent: <circle cx="16" cy="5" r="2.5" />,
  },
  spray: {
    lines: (
      <>
        <rect x="3" y="11" width="10" height="8" rx="1" />
        <path d="M8 11V7h6M13 15h3" />
        <path d="M18 15l10-6M18 15h10M18 15l10 6" />
      </>
    ),
    accent: <path d="M28 6.5a1.5 1.5 0 1 1 0 .01zM28 23.5a1.5 1.5 0 1 1 0 .01z" />,
  },
  harvest: {
    lines: (
      <>
        <path d="M16 29V6" />
        <path d="M16 11l-4-3M16 11l4-3M16 16l-4-3M16 16l4-3M16 21l-4-3M16 21l4-3" />
      </>
    ),
    accent: <ellipse cx="16" cy="5" rx="2" ry="3" />,
  },
  transport: {
    lines: (
      <>
        <path d="M3 9h16v12H3z" />
        <path d="M19 13h6l4 4v4H19" />
        <circle cx="8" cy="23" r="3" />
        <circle cx="23" cy="23" r="3" />
      </>
    ),
    accent: <rect x="6" y="12" width="10" height="6" />,
  },
  tractor: {
    lines: (
      <>
        <circle cx="10" cy="22" r="6" />
        <circle cx="25" cy="24" r="4" />
        <path d="M6 16V6h9l1 6h11v8" />
        <path d="M22 12V7" />
      </>
    ),
    accent: <rect x="8.5" y="8" width="5" height="4" />,
  },
  rotavator: {
    lines: (
      <>
        <path d="M4 10h24M16 10v4" />
        <circle cx="16" cy="21" r="6" />
        <path d="M16 15v12M10 21h12M12 17l8 8M20 17l-8 8" />
      </>
    ),
    accent: <circle cx="16" cy="21" r="2" />,
  },
  combine: {
    lines: (
      <>
        <path d="M3 10h17v12H3z" />
        <path d="M7 10V5h8v5" />
        <path d="M20 18h9" />
        <circle cx="25" cy="13" r="4" />
        <circle cx="8" cy="25" r="3" />
        <circle cx="17" cy="25" r="2" />
      </>
    ),
    accent: <rect x="8.5" y="6.5" width="5" height="3" />,
  },
  sprayer: {
    lines: (
      <>
        <rect x="8" y="5" width="16" height="11" rx="3" />
        <path d="M16 16v5M2 21h28" />
        <path d="M5 21v4M12 21v4M20 21v4M27 21v4" />
      </>
    ),
    accent: <rect x="10" y="11" width="12" height="3" />,
  },
  seedDrill: {
    lines: (
      <>
        <path d="M5 5h22l-4 9H9z" />
        <path d="M11 14v10M16 14v10M21 14v10" />
        <path d="M4 28h24" />
      </>
    ),
    accent: <path d="M11 26.5a1 1 0 1 1 0 .01zM16 26.5a1 1 0 1 1 0 .01zM21 26.5a1 1 0 1 1 0 .01z" />,
  },
  trolley: {
    lines: (
      <>
        <path d="M3 9h20v10H3z" />
        <path d="M23 16h7" />
        <circle cx="13" cy="23" r="4" />
      </>
    ),
    accent: <path d="M5 9l3-4h10l3 4z" />,
  },
  thresher: {
    lines: (
      <>
        <path d="M5 10h19v12H5z" />
        <path d="M24 12l6-5M5 16H2" />
        <circle cx="14" cy="16" r="4" />
        <circle cx="9" cy="25" r="2" />
        <circle cx="20" cy="25" r="2" />
      </>
    ),
    accent: <circle cx="14" cy="16" r="1.5" />,
  },
  baler: {
    lines: (
      <>
        <path d="M4 9h18v13H4z" />
        <path d="M22 19l7 5" />
        <path d="M8 13h10v5H8z" />
        <circle cx="13" cy="25" r="2" />
      </>
    ),
    accent: <rect x="9" y="14" width="8" height="3" />,
  },
};

export function Pictogram({
  name,
  accent = false,
  title,
  className,
}: {
  name: PictogramName;
  accent?: boolean;
  /** Give it a name only when it stands alone; next to a text label it stays decorative. */
  title?: string;
  className?: string;
}) {
  const art = ART[name];
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      className={className}
    >
      {title && <title>{title}</title>}
      {accent && (
        <g data-accent className="fill-[rgb(var(--sarson-400))]" stroke="none">
          {art.accent}
        </g>
      )}
      {art.lines}
    </svg>
  );
}
