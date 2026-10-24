import type { Metadata } from "next";
import { ListingFormView } from "../_components/listing-form";

export const metadata: Metadata = { title: "List your tractor | KhetiRental v2.0" };

export default function ListingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">List your tractor</h1>
      <p className="mt-2 max-w-prose text-muted">Tell us about the tractor, then verify that you own it. We block listings where the RC owner is not the person listing.</p>
      <div className="mt-8"><ListingFormView /></div>
    </section>
  );
}
