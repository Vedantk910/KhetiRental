"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { ENGINEERING_PAGES } from "@/lib/engineering";

/** Links between the engineering pages; scrolls sideways inside itself on a phone, never the page. */
export function EngineeringNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="How we built it" className="border-b border-border-subtle bg-surface">
      <ul className="mx-auto flex max-w-app gap-1 overflow-x-auto px-4 sm:px-6">
        <li>
          <Link
            href="/about/engineering"
            aria-current={pathname === "/about/engineering" ? "page" : undefined}
            className="flex min-h-tap items-center whitespace-nowrap border-b-[3px] border-transparent px-3 text-label text-text-muted aria-[current=page]:border-action aria-[current=page]:text-action"
          >
            Overview
          </Link>
        </li>
        {ENGINEERING_PAGES.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={pathname === p.href ? "page" : undefined}
              className="flex min-h-tap items-center whitespace-nowrap border-b-[3px] border-transparent px-3 text-label text-text-muted aria-[current=page]:border-action aria-[current=page]:text-action"
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
