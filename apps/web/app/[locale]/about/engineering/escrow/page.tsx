import type { Metadata } from "next";
import { EscrowStateMachine } from "@/components/escrow-state-machine";

export const metadata: Metadata = { title: "3-Stage Escrow" };

export default function EscrowPage() {
  return (
    <section className="mx-auto max-w-app px-4 py-12">
      <h1 className="text-h1 tracking-tight">3-stage milestone escrow</h1>
      <p className="mt-2 max-w-prose text-text-muted">
        This simulator shows how a booking&apos;s money is held and released. Press the buttons in order, or
        try the problem buttons to see what happens when something goes wrong.
      </p>
      <div className="mt-8">
        <EscrowStateMachine />
      </div>
    </section>
  );
}
