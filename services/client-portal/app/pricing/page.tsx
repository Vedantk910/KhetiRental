import type { Metadata } from "next";
import { PricingCalculator } from "@/components/pricing-calculator";

export const metadata: Metadata = { title: "Pricing Engine | KhetiRental v2.0" };

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Dynamic depreciation pricing</h1>
      <p className="mt-2 max-w-prose text-muted">
        Rate = (B<sub>base</sub> × μ<sub>season</sub> × δ<sub>soil</sub>) + (D<sub>wear</sub> × κ<sub>age</sub>) + (F × P<sub>diesel</sub>).
        Same model and constants as <code>analytics/pricing.py</code>; a test keeps the two identical.
      </p>
      <div className="mt-8"><PricingCalculator /></div>
    </section>
  );
}
