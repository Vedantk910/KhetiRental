// Payments mock (D-08): no gateway, no card data. Resolves after ~1.5 s; DEMO_PAYMENT_FAIL=true forces failure.
import { randomUUID } from "node:crypto";
import type { PaymentMethod } from "@/lib/domain";

export async function createPayment(p: { method: Exclude<PaymentMethod, "cash">; amountPaise: number }) {
  const delay = Number(process.env.DEMO_PAYMENT_DELAY_MS ?? 1500);
  await new Promise((r) => setTimeout(r, Number.isFinite(delay) ? delay : 1500));
  const failed = process.env.DEMO_PAYMENT_FAIL === "true";
  return {
    status: failed ? ("failed" as const) : ("paid_demo" as const),
    reference: `demo_${randomUUID()}`,
    ...p,
  };
}
