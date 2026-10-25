import { config } from "@/config/site";
import { helplineHref } from "@/lib/contact";

/** "Call us" as a tel: link once a real helpline is set; until then the text and the placeholder number. */
export function CallUs({ label, className }: { label: string; className?: string }) {
  const href = helplineHref();
  return href ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <span className={className}>
      {label} {config.helplinePhone}
    </span>
  );
}
