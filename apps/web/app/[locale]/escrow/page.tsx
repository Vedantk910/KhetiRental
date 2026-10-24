import type { Metadata } from "next";
import { EscrowStateMachine } from "@/components/escrow-state-machine";

export const metadata: Metadata = { title: "3-Stage Escrow | KhetiRental v2.0" };

export default function EscrowPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">3-stage milestone escrow</h1>
      <p className="mt-2 max-w-prose text-muted">
        Money moves only when each stage is verified: handover, the telematics window, then the return audit.
        Try the breach and tamper buttons to see dispute rules D-01 and D-02 freeze settlement.
      </p>
      <div className="mt-8">
        <EscrowStateMachine />
      </div>
    </section>
  );
}
