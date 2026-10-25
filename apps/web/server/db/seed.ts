// `npm run db:seed`: replaces the sample rows (is_sample = true) and leaves everything else alone.
import { hashPassword } from "../passwords";
import { bookingWindow, quote, REPLY_WINDOW_MS, todayIst } from "../pricing";
import { connect, DEFAULT_DATABASE_URL } from "./index";
import { buildSeed } from "./seed-data";
import type { Sql } from "postgres";

/** Sample password for every seeded account (dev only). */
export const SEED_PASSWORD = process.env.SEED_PASSWORD || "kheti-demo-2026";

export async function seed(sql: Sql, today = todayIst()) {
  const data = buildSeed(today);
  const passwordHash = await hashPassword(SEED_PASSWORD);
  await sql.begin(async (tx) => {
    await tx`DELETE FROM bookings WHERE is_sample`;
    await tx`DELETE FROM machines WHERE is_sample`;
    await tx`DELETE FROM users WHERE is_sample AND email <> 'demo.google@khetirental.test'`;
    await tx`DELETE FROM pin_codes WHERE is_sample`;
    for (const p of data.pins) {
      await tx`INSERT INTO pin_codes (pin, office, village, district, state, location, is_sample)
        VALUES (${p.pin}, ${p.office}, ${p.village}, ${p.district}, ${p.state},
                ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography, true)`;
    }
    const ids = new Map<string, string>();
    for (const u of data.users) {
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO users (name, email, email_verified, phone, phone_verified_at, password_hash, roles, is_sample)
        VALUES (${u.name}, ${u.email}, now(), ${u.phone}, ${u.phone ? new Date().toISOString() : null}::timestamptz, ${passwordHash}, ${u.roles}, true)
        RETURNING id`;
      ids.set(u.key, row.id);
    }
    // The "Mock Google" account (D-05).
    await tx`INSERT INTO users (name, email, email_verified, roles, is_sample)
      VALUES ('Demo Google User', 'demo.google@khetirental.test', now(), '{renter}', true) ON CONFLICT (email) DO NOTHING`;
    const machineIds: string[] = [];
    for (const m of data.machines) {
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO machines (owner_id, category, make, model, hp, year, hour_meter, last_serviced, attachments, location,
          village, pin, price_unit, price_paise, operator_included, diesel_included, rc_status, active, is_sample)
        VALUES (${ids.get(m.owner) ?? ""}, ${m.category}, ${m.make}, ${m.model}, ${m.hp}, ${m.year}, ${m.hourMeter},
          ${m.lastServiced}, ${m.attachments}, ST_SetSRID(ST_MakePoint(${m.lng}, ${m.lat}), 4326)::geography,
          ${m.village}, ${m.pin}, ${m.priceUnit}, ${m.pricePaise}, ${m.operatorIncluded}, ${m.dieselIncluded}, ${m.rcStatus}, ${m.active}, true)
        RETURNING id`;
      machineIds.push(row.id);
    }
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    for (const b of data.bookings) {
      const m = data.machines[b.machineIdx];
      const w = bookingWindow(b.startDate, b.endDate, b.slot);
      const q = quote({ ...m, dieselIncluded: m.dieselIncluded }, { days: w.days, slot: b.slot });
      const created = b.ageMin !== undefined ? now - b.ageMin * 60_000 : w.start.getTime() - 3 * 86_400_000;
      // Requests are the only ones with a reply clock; the rest were answered right away.
      const open = b.status === "REQUESTED" || b.status === "EXPIRED";
      const replyBy = open ? created + REPLY_WINDOW_MS : created;
      const confirmed = ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(b.status);
      const closed =
        b.status === "COMPLETED"
          ? w.end.getTime()
          : b.status === "EXPIRED"
            ? replyBy
            : ["CANCELLED", "DECLINED"].includes(b.status)
              ? created + 30 * 60_000
              : null;
      const renterId = ids.get(b.renter) ?? "";
      const ownerId = ids.get(m.owner) ?? "";
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit, rate_paise,
          rent_paise, deposit_paise, diesel_included, total_paise, status, reply_by, idempotency_key, confirmed_at,
          closed_at, decline_reason, cancelled_by, cancel_reason, is_sample, created_at)
        VALUES (${b.code}, ${machineIds[b.machineIdx]}, ${renterId},
          tstzrange(${w.start.toISOString()}::timestamptz, ${w.end.toISOString()}::timestamptz, '[)'),
          ${b.startDate}, ${b.endDate}, ${b.slot}, ${q.qty}, ${q.unit}, ${q.ratePaise}, ${q.rentPaise}, ${q.depositPaise},
          ${q.dieselIncluded}, ${q.totalPaise}, ${b.status},
          ${iso(b.status === "REQUESTED" && b.ageMin === undefined ? now + REPLY_WINDOW_MS : replyBy)}::timestamptz,
          ${`seed-${b.code}-${b.startDate}`},
          ${confirmed ? iso(created + 20 * 60_000) : null}::timestamptz,
          ${closed === null ? null : iso(closed)}::timestamptz,
          ${b.declineReason ?? null},
          ${b.cancelledBy === "owner" ? ownerId : b.cancelledBy === "renter" ? renterId : null},
          ${b.cancelReason ?? null}, true,
          ${iso(b.status === "REQUESTED" && b.ageMin === undefined ? now : created)}::timestamptz)
        RETURNING id`;
      if (b.stars) {
        await tx`INSERT INTO reviews (booking_id, author_id, target_user_id, stars, text)
          VALUES (${row.id}, ${renterId}, ${ownerId}, ${b.stars}, ${b.review ?? null})`;
      }
      if (["COMPLETED", "IN_PROGRESS", "CONFIRMED"].includes(b.status)) {
        const [method, status] = b.method === "upi" ? ["upi", "paid_demo"] : ["cash", "pay_later"];
        await tx`INSERT INTO payments (booking_id, method, status, amount_paise) VALUES (${row.id}, ${method}, ${status}, ${q.totalPaise})`;
      }
      if (b.problem) {
        await tx`INSERT INTO problem_reports (booking_id, reporter_id, type, text, status, note)
          VALUES (${row.id}, ${b.problem.by === "owner" ? ownerId : renterId}, ${b.problem.type}, ${b.problem.text},
                  ${b.problem.status}, ${b.problem.note ?? null})`;
      }
      if (b.notify) {
        const sent = [
          ...(b.status === "REQUESTED" ? [[ownerId, "booking_requested"]] : []),
          ...(b.status === "CONFIRMED" || b.status === "IN_PROGRESS" ? [[renterId, "booking_accepted"]] : []),
          ...(b.status === "DECLINED" ? [[renterId, "booking_declined"]] : []),
          ...(b.status === "EXPIRED" ? [[renterId, "booking_expired"]] : []),
          ...(b.status === "CANCELLED"
            ? [[b.cancelledBy === "owner" ? renterId : ownerId, "booking_cancelled"]]
            : []),
          ...(b.status === "COMPLETED" ? [[ownerId, "payment_recorded"]] : []),
          ...(b.problem ? [[b.problem.by === "owner" ? renterId : ownerId, "problem_reported"]] : []),
        ];
        // What is already done (completed, in the field) has been seen; anything waiting on someone has not.
        const seen = b.status === "COMPLETED" || b.status === "IN_PROGRESS";
        for (const [userId, type] of sent) {
          await tx`INSERT INTO notifications (user_id, type, booking_id, read_at, created_at)
            VALUES (${userId}, ${type}, ${row.id}, ${seen ? iso(now) : null}::timestamptz, ${iso(Math.min(now, created + 25 * 60_000))}::timestamptz)`;
        }
      }
    }
    for (const k of data.blocks) {
      await tx`INSERT INTO machine_blocks (machine_id, day) VALUES (${machineIds[k.machineIdx]}, ${k.day}) ON CONFLICT DO NOTHING`;
    }
  });
  return {
    machines: data.machines.length,
    bookings: data.bookings.length,
    users: data.users.length,
    pins: data.pins.length,
  };
}

// CLI entry (tsx server/db/seed.ts)
if (process.argv[1]?.endsWith("seed.ts")) {
  const c = connect(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL, 1);
  seed(c.sql)
    .then((n) => {
      console.info(`Seeded sample data: ${JSON.stringify(n)}`);
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => {
      void c.sql.end();
    });
}
