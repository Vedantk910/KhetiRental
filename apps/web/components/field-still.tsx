/** Decorative still frame of the welcome field: ploughed strips, a tractor, the sun (UI-SPEC §4.21). */
export function FieldStill({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" aria-hidden="true" className={className}>
      <rect width="240" height="120" rx="16" className="fill-[rgb(var(--neel-100))]" />
      <circle cx="198" cy="30" r="14" className="fill-[rgb(var(--sarson-400))]" />
      <path d="M0 72h240v48H0z" className="fill-[rgb(var(--sarson-300))]" />
      <path d="M0 84h240M0 96h240M0 108h240" className="stroke-[rgb(var(--sarson-600))]" strokeWidth="3" />
      <g
        transform="translate(64 44)"
        className="fill-none stroke-[rgb(var(--n-950))]"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <path d="M6 24V4h18l2 12h22v14" className="fill-[rgb(var(--neel-700))]" />
        <circle cx="14" cy="34" r="10" className="fill-[rgb(var(--n-50))]" />
        <circle cx="44" cy="36" r="6" className="fill-[rgb(var(--n-50))]" />
      </g>
    </svg>
  );
}
