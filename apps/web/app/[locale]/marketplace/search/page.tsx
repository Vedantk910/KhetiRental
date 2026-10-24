import type { Metadata } from "next";
import { MarketplaceSearch } from "../_components/search";

export const metadata: Metadata = { title: "Find a tractor | KhetiRental v2.0" };

export default function SearchPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Find a tractor near you</h1>
      <p className="mt-2 max-w-prose text-muted">
        Choose the job and where your farm is. Prices include fuel and show the refundable deposit before you
        book.
      </p>
      <div className="mt-8">
        <MarketplaceSearch />
      </div>
    </section>
  );
}
