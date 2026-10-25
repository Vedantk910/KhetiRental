import type { Metadata } from "next";
import { PricingCalculator } from "@/components/pricing-calculator";

export const metadata: Metadata = { title: "Pricing Engine" };

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-app px-4 py-12">
      <h1 className="text-h1 tracking-tight">Dynamic depreciation pricing</h1>
      <p className="mt-3 text-body font-bold">
        In plain words: a calculator that shows how a machine&apos;s hourly price is worked out, and how fast
        an owner earns the machine back.
      </p>
      <p className="mt-2 max-w-prose text-text-muted">
        Rate = (B<sub>base</sub> × μ<sub>season</sub> × δ<sub>soil</sub>) + (D<sub>wear</sub> × κ
        <sub>age</sub>) + (F × P<sub>diesel</sub>). Same model and constants as{" "}
        <code>showcase/analytics/pricing.py</code>; a test keeps the two identical.
      </p>
      <div className="mt-8">
        <PricingCalculator />
      </div>
    </section>
  );
}
