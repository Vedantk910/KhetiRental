import { randomUUID } from "node:crypto";
import type { Role } from "@/lib/domain";
import { getSql } from "../db";
import { createSession } from "../session";

let n = 0;

export async function makeUser(roles: Role[] = ["renter"], over: { phone?: string; email?: string } = {}) {
  n += 1;
  const sql = getSql();
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (name, email, phone, roles)
    VALUES (${`Test User ${n}`}, ${over.email ?? `u${n}-${randomUUID().slice(0, 6)}@test.local`}, ${over.phone ?? null}, ${roles})
    RETURNING id`;
  const token = await createSession(u.id);
  return { id: u.id, token, cookie: `authjs.session-token=${token}` };
}
export type TestUser = Awaited<ReturnType<typeof makeUser>>;

export interface MachineOpts {
  lat?: number;
  lng?: number;
  category?: string;
  attachments?: string[];
  priceUnit?: "hour" | "acre" | "day";
  pricePaise?: number;
  hp?: number | null;
  active?: boolean;
}

/** Latur town centre by default. */
export async function makeMachine(ownerId: string, o: MachineOpts = {}) {
  const sql = getSql();
  const [m] = await sql<{ id: string }[]>`
    INSERT INTO machines (owner_id, category, make, model, hp, year, attachments, location, village, pin,
                          price_unit, price_paise, active)
    VALUES (${ownerId}, ${o.category ?? "tractor"}, 'Mahindra', '575 DI', ${o.hp === undefined ? 45 : o.hp}, 2019,
            ${o.attachments ?? ["rotavator"]},
            ST_SetSRID(ST_MakePoint(${o.lng ?? 76.5604}, ${o.lat ?? 18.4088}), 4326)::geography,
            'Latur', '413512', ${o.priceUnit ?? "hour"}, ${o.pricePaise ?? 75_000}, ${o.active ?? true})
    RETURNING id`;
  return m.id;
}

/** A future date (IST) n days from today, YYYY-MM-DD. */
export const inDays = (d: number) =>
  new Date(Date.now() + 5.5 * 3600_000 + d * 86_400_000).toISOString().slice(0, 10);

export const json = (
  body: unknown,
  init: { cookie?: string; headers?: Record<string, string>; method?: string } = {},
) => ({
  method: init.method ?? "POST",
  headers: {
    "content-type": "application/json",
    ...(init.cookie ? { cookie: init.cookie } : {}),
    ...init.headers,
  },
  body: JSON.stringify(body),
});

export const req = (path: string, init?: RequestInit) => new Request(`http://localhost:3000${path}`, init);
