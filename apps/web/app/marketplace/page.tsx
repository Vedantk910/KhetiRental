import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Marketplace | KhetiRental v2.0" };

const btn = "inline-flex rounded-lg px-5 py-3 font-semibold";

export default function MarketplacePage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Rent a tractor from a neighbour</h1>
      <p className="mt-3 max-w-prose text-lg text-muted">
        Farmers find a nearby tractor, see the full price up front and pay into escrow. Owners list a tractor
        once and get paid after every clean return.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-xl font-bold">I need a tractor</h2>
          <p className="mt-2 text-muted">
            Pick the job, your village and dates. The rate and refundable deposit are shown before you commit.
          </p>
          <Link href="/marketplace/search" className={`${btn} mt-5 bg-primary text-primary-fg`}>
            Find a tractor
          </Link>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-xl font-bold">I own a tractor</h2>
          <p className="mt-2 text-muted">
            Add your tractor and verify your Aadhaar and RC. The RC must be in your name.
          </p>
          <Link href="/marketplace/listing" className={`${btn} mt-5 border border-line`}>
            List my tractor
          </Link>
        </div>
      </div>
      <p className="mt-8 max-w-prose text-sm text-muted">
        This is a demo. Tractors, owners and ratings are made up, and no payment or document leaves your
        browser.
      </p>
    </section>
  );
}
