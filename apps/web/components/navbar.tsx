"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sprout, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PAGES = [
  { label: "Marketplace Demo", href: "/marketplace" },
  { label: "H3 Spatial Sandbox", href: "/architecture/h3-spatial" },
  { label: "Pricing Engine", href: "/pricing" },
  { label: "3-Stage Escrow", href: "/escrow" },
  { label: "Architecture & ADRs", href: "/architecture" },
];
const TRACKS = [
  { label: "Track B: Vedant (Product)", href: "/dossier/track-b-product" },
  { label: "Track A: Tarun (Systems)", href: "/dossier/track-a-systems" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    // Close if the viewport grows past the mobile breakpoint, so state never lingers hidden.
    const mq = window.matchMedia("(min-width: 1360px)");
    const onMq = () => {
      if (mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  const link = (l: { label: string; href: string }, extra?: string) => (
    <Link
      key={l.href}
      href={l.href}
      aria-current={pathname === l.href ? "page" : undefined}
      onClick={() => {
        setOpen(false);
      }}
      className={cn(
        "whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-fg aria-[current=page]:bg-primary aria-[current=page]:text-primary-fg",
        extra,
      )}
    >
      {l.label}
    </Link>
  );

  return (
    <header className="bg-bg/95 sticky top-0 z-40 border-b border-line backdrop-blur">
      <nav aria-label="Primary" className="mx-auto max-w-screen-2xl px-4">
        <div className="flex items-center gap-2 py-3">
          <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-bold text-fg">
            <Sprout aria-hidden className="h-6 w-6 text-primary" />
            <span>KhetiRental v2.0</span>
          </Link>
          <span className="whitespace-nowrap rounded-full border border-soil px-2.5 py-0.5 text-xs font-semibold text-soil">
            Demo mode
          </span>

          <div className="mx-auto hidden items-center gap-1 nav:flex">{PAGES.map((l) => link(l))}</div>
          <div className="hidden items-center gap-1 rounded-lg border border-line p-1 nav:flex">
            {TRACKS.map((l) => link(l))}
          </div>

          <button
            ref={btn}
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => {
              setOpen((o) => !o);
            }}
            className="ml-auto rounded-md border border-line p-2 nav:hidden"
          >
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
        </div>
        <div id="mobile-menu" hidden={!open} className="border-t border-line py-3 nav:hidden">
          <div className="flex flex-col gap-1">{[...PAGES, ...TRACKS].map((l) => link(l))}</div>
        </div>
      </nav>
    </header>
  );
}
