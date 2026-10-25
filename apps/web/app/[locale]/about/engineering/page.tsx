import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ENGINEERING_PAGES } from "@/lib/engineering";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export const metadata: Metadata = { title: "How we built it" };

const ABOUT: Record<(typeof ENGINEERING_PAGES)[number]["href"], string> = {
  "/about/engineering/systems":
    "How a nearby machine is found in milliseconds, how double bookings are prevented, and what each change bought in a load test.",
  "/about/engineering/product":
    "The four big decisions, the owner's maths, and how money is held until the work is proven.",
  "/about/engineering/architecture": "The services, the database and the decision records behind them.",
  "/about/engineering/h3-spatial":
    "A practice map: drop a farm on a grid of hexagons and see which machines are searched.",
  "/about/engineering/escrow": "A simulator for how a booking's money is held and released, step by step.",
  "/about/engineering/pricing":
    "A calculator for the hourly price and for how fast an owner earns a tractor back.",
};

export default async function EngineeringIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  return (
    <div className="mx-auto max-w-app px-4 py-12 sm:px-6">
      <h1 className="text-h1">How we built it</h1>
      <p className="mt-3 max-w-prose text-body text-text-muted">
        The farmer app is what you use to rent a machine. These pages are for people who want to see how it
        works underneath. They are in English, and all the machines and bookings on them are made up.
      </p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {ENGINEERING_PAGES.map((p) => (
          <li key={p.href}>
            <Card as="div" className="flex h-full flex-col gap-2">
              <h2 className="text-h3">
                <Link
                  href={p.href}
                  className="inline-flex min-h-tap min-w-tap items-center text-link underline underline-offset-4"
                >
                  {p.title}
                </Link>
              </h2>
              <p className="text-body text-text-muted">{ABOUT[p.href]}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
