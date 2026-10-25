// @vitest-environment node
// M5: owner dashboard data, calendar, price hint, owner mode, upload privacy, demo admin, and the
// owner-side races. Real Postgres + PostGIS, through the route handlers.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET as meRoute } from "@/app/api/me/route";
import { POST as enableRoute } from "@/app/api/owner/enable/route";
import { GET as calendarRoute } from "@/app/api/owner/machines/[id]/calendar/route";
import { GET as hintRoute } from "@/app/api/owner/price-hint/route";
import { GET as overviewRoute } from "@/app/api/admin/overview/route";
import { POST as rcRoute } from "@/app/api/admin/machines/[id]/rc/route";
import { PATCH as problemPatchRoute } from "@/app/api/admin/problems/[id]/route";
import { GET as usersRoute } from "@/app/api/admin/users/route";
import { PATCH as userPatchRoute } from "@/app/api/admin/users/[id]/route";
import { GET as uploadRoute } from "@/app/api/uploads/[name]/route";
import { PUT as blocksRoute } from "@/app/api/owner/machines/[id]/blocks/route";
import { PATCH as patchRoute } from "@/app/api/owner/machines/[id]/route";
import { POST as photoRoute } from "@/app/api/owner/machines/[id]/photos/route";
import { POST as problemRoute } from "@/app/api/bookings/[id]/problems/route";
import { GET as byCodeRoute } from "@/app/api/bookings/by-code/[code]/route";
import { POST as acceptRoute } from "@/app/api/bookings/[id]/accept/route";
import { POST as declineRoute } from "@/app/api/bookings/[id]/decline/route";
import { POST as cancelRoute } from "@/app/api/bookings/[id]/cancel/route";
import { POST as bookRoute } from "@/app/api/bookings/route";
import { GET as searchRoute } from "@/app/api/machines/route";
import { getMyMachine, ownerEarnings } from "@/server/owner";
import type { SessionUser } from "@/server/session";
import { inDays, json, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
let uploads: string;
beforeAll(async () => {
  t = await createTestDb();
  uploads = await mkdtemp(path.join(tmpdir(), "kheti-m5-"));
  process.env.UPLOAD_DIR = uploads;
});
afterAll(async () => {
  await rm(uploads, { recursive: true, force: true });
  await t.drop();
});

const p = <P>(x: P) => ({ params: Promise.resolve(x) });
const none = p<Record<string, never>>({});
const as = (u: TestUser | null): RequestInit => (u ? { headers: { cookie: u.cookie } } : {});
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const key = () => crypto.randomUUID();
const book = (u: TestUser, machineId: string, offset: number, endOffset = offset) =>
  bookRoute(
    req(
      "/api/bookings",
      json(
        { machineId, startDate: inDays(offset), endDate: inDays(endOffset), slot: "full", qty: 4 },
        { cookie: u.cookie, headers: { "idempotency-key": key() } },
      ),
    ),
    none,
  );
const post = (fn: typeof acceptRoute, u: TestUser | null, id: string, body: unknown = {}) =>
  fn(req(`/api/bookings/${id}/x`, json(body, { cookie: u?.cookie })), p({ id }));
const block = (u: TestUser | null, id: string, days: string[], blocked = true) =>
  blocksRoute(req("/x", json({ days, blocked }, { cookie: u?.cookie, method: "PUT" })), p({ id }));
const upload = (u: TestUser, id: string, kind: string) => {
  const fd = new FormData();
  fd.set("photo", new File([PNG], "x.png", { type: "image/png" }));
  fd.set("kind", kind);
  return photoRoute(
    req(`/api/owner/machines/${id}/photos`, { method: "POST", body: fd, headers: { cookie: u.cookie } }),
    p({ id }),
  );
};
const serve = (u: TestUser | null, url: string) =>
  uploadRoute(req(url, as(u)), p({ name: url.split("/").pop() ?? "" }));
const su = (u: TestUser, roles: SessionUser["roles"] = ["owner"]): SessionUser => ({
  id: u.id,
  name: null,
  email: null,
  phone: null,
  roles,
});
let codeN = 1000;
async function seedBooking(
  machineId: string,
  renterId: string,
  o: { status: string; day: string; endDay?: string; rentPaise?: number },
) {
  const rent = o.rentPaise ?? 100_000;
  const [b] = await t.sql<{ id: string; code: string }[]>`
    INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit, rate_paise,
      rent_paise, deposit_paise, diesel_included, total_paise, reply_by, idempotency_key, status)
    VALUES (${`KR-${++codeN}`}, ${machineId}, ${renterId},
      tstzrange((${o.day}::date + time '07:00') AT TIME ZONE 'Asia/Kolkata',
                (${o.endDay ?? o.day}::date + time '19:00') AT TIME ZONE 'Asia/Kolkata', '[)'),
      ${o.day}, ${o.endDay ?? o.day}, 'full', 1, 'day', ${rent}, ${rent}, 0, true, ${rent},
      now() + interval '2 hours', ${key()}, ${o.status})
    RETURNING id, code`;
  return b;
}

describe("owner earnings (ledger)", () => {
  it("this month = paid + coming, net of the 13.5 % fee; requests, declined and other owners don't count", async () => {
    const owner = await makeUser(["owner"]);
    const other = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const om = await makeMachine(other.id);
    await seedBooking(m, renter.id, { status: "COMPLETED", day: "2031-11-03", rentPaise: 200_000 });
    await seedBooking(m, renter.id, { status: "CONFIRMED", day: "2031-11-10", rentPaise: 100_000 }); // job over → paid
    await seedBooking(m, renter.id, { status: "CONFIRMED", day: "2031-11-20", rentPaise: 100_000 });
    await seedBooking(m, renter.id, { status: "REQUESTED", day: "2031-11-22" });
    await seedBooking(m, renter.id, { status: "DECLINED", day: "2031-11-25" });
    await seedBooking(m, renter.id, { status: "CANCELLED", day: "2031-11-26" });
    await seedBooking(m, renter.id, { status: "CONFIRMED", day: "2031-12-02" });
    await seedBooking(om, renter.id, { status: "CONFIRMED", day: "2031-11-20" });
    const e = await ownerEarnings(su(owner), new Date("2031-11-15T10:00:00+05:30"));
    expect(e).toEqual({ monthPaise: 346_000, paidPaise: 259_500, comingPaise: 86_500 });
    expect(await ownerEarnings(su(await makeUser(["owner"])), new Date("2031-11-15T10:00:00+05:30"))).toEqual(
      {
        monthPaise: 0,
        paidPaise: 0,
        comingPaise: 0,
      },
    );
  });
});

describe("GET /api/owner/machines/[id]/calendar", () => {
  it("shows booked (with the code), blocked and free days; only the owner may look", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const month = inDays(10).slice(0, 7);
    const b = await seedBooking(m, renter.id, { status: "CONFIRMED", day: inDays(10), endDay: inDays(11) });
    await block(owner, m, [inDays(12)]);
    const cal = (u: TestUser | null, id: string, q = month) =>
      calendarRoute(req(`/api/owner/machines/${id}/calendar?month=${q}`, as(u)), p({ id }));
    const r = await cal(owner, m);
    expect(r.status).toBe(200);
    const days = (await r.json()).days as { date: string; state: string; code?: string }[];
    const at = (d: string) => days.find((x) => x.date === d);
    expect(at(inDays(10))).toMatchObject({ state: "busy", code: b.code, status: "CONFIRMED" });
    expect(at(inDays(11))).toMatchObject({ state: "busy", code: b.code });
    expect(at(inDays(12))).toMatchObject({ state: "blocked" });
    expect(at(inDays(13))?.state).toBe("free");
    expect((await cal(await makeUser(["owner"]), m)).status).toBe(404);
    expect((await cal(await makeUser(["renter"]), m)).status).toBe(403);
    expect((await cal(null, m)).status).toBe(401);
    for (const bad of ["2031-13", "abc", "2031-1", "1999-01", "2099-01", "' OR 1=1 --"])
      expect((await cal(owner, m, bad)).status, bad).toBe(400);
  });
});

describe("GET /api/owner/price-hint", () => {
  it("the 25th–75th percentile of live machines of the same kind and unit within 25 km", async () => {
    const owner = await makeUser(["owner"]);
    for (const rupees of [1000, 1200, 1400, 1600])
      await makeMachine(owner.id, { category: "rotavator", priceUnit: "acre", pricePaise: rupees * 100 });
    await makeMachine(owner.id, { category: "rotavator", priceUnit: "acre", pricePaise: 900_000, lat: 19.5 }); // far
    await makeMachine(owner.id, { category: "rotavator", priceUnit: "hour", pricePaise: 900_000 }); // other unit
    await makeMachine(owner.id, {
      category: "rotavator",
      priceUnit: "acre",
      pricePaise: 900_000,
      active: false,
    });
    const hint = (u: TestUser | null, q: string) => hintRoute(req(`/api/owner/price-hint?${q}`, as(u)), none);
    const r = await hint(owner, "category=rotavator&unit=acre&lat=18.4088&lng=76.5604");
    expect(await r.json()).toEqual({ n: 4, minRupees: 1150, maxRupees: 1450 });
    // too few to say anything: the box stays hidden
    expect(await (await hint(owner, "category=sprayer&unit=acre&lat=18.4&lng=76.56")).json()).toEqual({
      n: 0,
    });
    expect((await hint(owner, "category=nope&unit=acre&lat=18.4&lng=76.56")).status).toBe(400);
    expect((await hint(owner, "category=sprayer&unit=acre")).status).toBe(400);
    expect((await hint(await makeUser(["renter"]), "category=sprayer&unit=acre&lat=1&lng=1")).status).toBe(
      403,
    );
    expect((await hint(null, "category=sprayer&unit=acre&lat=1&lng=1")).status).toBe(401);
  });
});

describe("owner mode and /api/me", () => {
  it("a renter turns owner mode on (once, harmlessly repeated) and can then list; strangers can't", async () => {
    const u = await makeUser(["renter"]);
    expect(await (await meRoute(req("/api/me", as(u)), none)).json()).toMatchObject({ roles: ["renter"] });
    expect((await meRoute(req("/api/me", as(null)), none)).status).toBe(401);
    expect((await enableRoute(req("/x", json({}, {})), none)).status).toBe(401);
    for (let i = 0; i < 3; i++) {
      const r = await enableRoute(req("/x", json({}, { cookie: u.cookie })), none);
      expect(r.status).toBe(200);
      expect((await r.json()).roles).toEqual(["renter", "owner"]);
    }
  });
});

describe("getMyMachine (the edit page's data)", () => {
  it("returns everything editable, RC included, to the owner only", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id);
    await upload(owner, m, "front");
    await upload(owner, m, "rc");
    await block(owner, [m][0], [inDays(7)]);
    const got = await getMyMachine(su(owner), m);
    expect(got).toMatchObject({ id: m, make: "Mahindra", priceRupees: 750, rcStatus: "pending" });
    expect(got.photos.map((x) => x.kind).sort()).toEqual(["front", "rc"]);
    expect(got.blockedDays).toEqual([inDays(7)]);
    expect(got.lat).toBeCloseTo(18.4088, 3);
    await expect(getMyMachine(su(await makeUser(["owner"])), m)).rejects.toMatchObject({ status: 404 });
  });
});

describe("what an owner sees of the renter", () => {
  it("a short name always; the phone only after accepting", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser(["renter"], { phone: "+919876500001" });
    const m = await makeMachine(owner.id);
    const b = await (await book(renter, m, 6)).json();
    const look = async () => (await byCodeRoute(req("/x", as(owner)), p({ code: b.code }))).json();
    let v = await look();
    expect(v.renter.name).toMatch(/^Test U\.$/);
    expect(v.renter.phone).toBeNull();
    await post(acceptRoute, owner, b.id);
    v = await look();
    expect(v.renter.name).toMatch(/^Test U\.$/);
    expect(v.renter.phone).toBe("+919876500001");
  });
});

describe("pausing a machine", () => {
  it("drops it from search; resuming brings it back", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id, { lat: 18.9, lng: 76.9 });
    const search = async () =>
      (
        await (await searchRoute(req("/api/machines?lat=18.9&lng=76.9&radius=5", as(renter)), none)).json()
      ).items.map((i: { id: string }) => i.id);
    expect(await search()).toContain(m);
    const patch = (active: boolean) =>
      patchRoute(req("/x", json({ active }, { cookie: owner.cookie, method: "PATCH" })), p({ id: m }));
    expect((await patch(false)).status).toBe(200);
    expect(await search()).not.toContain(m);
    expect((await patch(true)).status).toBe(200);
    expect(await search()).toContain(m);
  });
});

describe("the owner against a crowd", () => {
  it("20 parallel accepts → one wins and the renter hears once; accept after decline or cancel is refused", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const b = await (await book(renter, m, 20)).json();
    const res = await Promise.all(Array.from({ length: 20 }, () => post(acceptRoute, owner, b.id)));
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect(res.filter((r) => r.status === 409)).toHaveLength(19);
    const n =
      await t.sql`SELECT 1 FROM notifications WHERE user_id = ${renter.id} AND booking_id = ${b.id} AND type = 'booking_accepted'`;
    expect(n).toHaveLength(1);
    expect((await post(declineRoute, owner, b.id, { reason: "busy" })).status).toBe(409);

    const b2 = await (await book(renter, m, 22)).json();
    expect((await post(declineRoute, owner, b2.id, { reason: "busy" })).status).toBe(200);
    expect((await post(acceptRoute, owner, b2.id)).status).toBe(409);

    const b3 = await (await book(renter, m, 24)).json();
    await post(cancelRoute, renter, b3.id);
    expect((await post(acceptRoute, owner, b3.id)).status).toBe(409);
  });

  it("accept and decline at the same instant: exactly one decision stands", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id);
    for (let i = 0; i < 6; i++) {
      const b = await (await book(await makeUser(), m, 30 + i * 2)).json();
      const [a, d] = await Promise.all([
        post(acceptRoute, owner, b.id),
        post(declineRoute, owner, b.id, { reason: "too_far" }),
      ]);
      expect([a.status, d.status].sort()).toEqual([200, 409]);
      const [row] = await t.sql<{ status: string }[]>`SELECT status FROM bookings WHERE id = ${b.id}`;
      expect(row.status).toBe(a.status === 200 ? "CONFIRMED" : "DECLINED");
    }
  });

  it("accepting after the 2-hour window is refused even if nobody refreshed the list", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const b = await (await book(renter, m, 21)).json();
    await t.sql`UPDATE bookings SET reply_by = now() - interval '1 second' WHERE id = ${b.id}`;
    const r = await post(acceptRoute, owner, b.id);
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("reply_window_closed");
    const [row] = await t.sql<{ status: string }[]>`SELECT status FROM bookings WHERE id = ${b.id}`;
    expect(row.status).toBe("EXPIRED");
  });

  it("owner B can't accept, decline, block, pause, or look at owner A's machine and request; a renter can't either", async () => {
    const a = await makeUser(["owner"]);
    const b = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(a.id);
    const bk = await (await book(renter, m, 26)).json();
    expect((await post(acceptRoute, b, bk.id)).status).toBe(404);
    expect((await post(declineRoute, b, bk.id, { reason: "busy" })).status).toBe(404);
    expect((await post(acceptRoute, renter, bk.id)).status).toBe(403);
    expect((await block(b, m, [inDays(40)])).status).toBe(404);
    expect((await block(renter, m, [inDays(40)])).status).toBe(403);
    const pause = (u: TestUser) =>
      patchRoute(req("/x", json({ active: false }, { cookie: u.cookie, method: "PATCH" })), p({ id: m }));
    expect((await pause(b)).status).toBe(404);
    expect((await pause(renter)).status).toBe(403);
    expect((await upload(b, m, "front")).status).toBe(404);
    expect((await byCodeRoute(req("/x", as(b)), p({ code: bk.code }))).status).toBe(404);
    const [row] = await t.sql<{ active: boolean }[]>`SELECT active FROM machines WHERE id = ${m}`;
    expect(row.active).toBe(true);
  });

  it("blocking a day while a renter books it never leaves both (20 rounds)", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id);
    for (let i = 0; i < 20; i++) {
      const renter = await makeUser();
      const d = 60 + i;
      const [bk, bl] = await Promise.all([book(renter, m, d), block(owner, m, [inDays(d)])]);
      expect([201, 409]).toContain(bk.status);
      expect([200, 409]).toContain(bl.status);
      const both = await t.sql`
        SELECT 1 FROM machine_blocks k WHERE k.machine_id = ${m} AND k.day = ${inDays(d)}::date
          AND EXISTS (SELECT 1 FROM bookings b WHERE b.machine_id = ${m} AND b.start_date = ${inDays(d)}::date
                      AND b.status IN ('REQUESTED','CONFIRMED','IN_PROGRESS'))`;
      expect(both, `day +${d}`).toHaveLength(0);
    }
  });

  it("hostile prices never reach the table", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id);
    for (const priceRupees of [-5, 0, 1e9, 1400.5, "1400", null, Number.NaN, 1e300])
      expect(
        (
          await patchRoute(
            req("/x", json({ priceRupees }, { cookie: owner.cookie, method: "PATCH" })),
            p({ id: m }),
          )
        ).status,
        String(priceRupees),
      ).toBe(400);
    const [row] = await t.sql<{ price_paise: number }[]>`SELECT price_paise FROM machines WHERE id = ${m}`;
    expect(row.price_paise).toBe(75_000);
  });
});

describe("uploads are private where they should be", () => {
  it("RC photos: owner and admin only. Machine photos: any signed-in user. Problem photos: the two parties and admin", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const stranger = await makeUser();
    const admin = await makeUser(["admin", "renter"]);
    const m = await makeMachine(owner.id);
    const front = await (await upload(owner, m, "front")).json();
    const rc = await (await upload(owner, m, "rc")).json();
    expect((await serve(stranger, front.url)).status).toBe(200);
    expect((await serve(null, front.url)).status).toBe(401);
    expect((await serve(owner, rc.url)).status).toBe(200);
    expect((await serve(admin, rc.url)).status).toBe(200);
    expect((await serve(stranger, rc.url)).status).toBe(404);
    expect((await serve(renter, rc.url)).status).toBe(404);

    const bk = await (await book(renter, m, 33)).json();
    const fd = new FormData();
    fd.set("type", "no_show");
    fd.append("photos", new File([PNG], "p.png", { type: "image/png" }));
    const rep = await (
      await problemRoute(
        req(`/api/bookings/${bk.id}/problems`, {
          method: "POST",
          body: fd,
          headers: { cookie: renter.cookie },
        }),
        p({ id: bk.id }),
      )
    ).json();
    const photo = rep.photos[0] as string;
    for (const who of [renter, owner, admin]) expect((await serve(who, photo)).status).toBe(200);
    expect((await serve(stranger, photo)).status).toBe(404);
    // a file nothing refers to is not served to anyone
    expect((await serve(owner, `/api/uploads/${crypto.randomUUID()}.png`)).status).toBe(404);
  });
});

describe("demo admin", () => {
  const adminGet = (u: TestUser | null, q = "") => overviewRoute(req(`/api/admin/overview${q}`, as(u)), none);
  const reviewRc = (u: TestUser | null, id: string, decision: unknown) =>
    rcRoute(req("/x", json({ decision }, { cookie: u?.cookie })), p({ id }));

  it("every admin route refuses the signed-out (401), renters and owners (403)", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const id = crypto.randomUUID();
    for (const who of [null, renter, owner]) {
      const want = who ? 403 : 401;
      expect((await adminGet(who)).status).toBe(want);
      expect((await reviewRc(who, id, "checked")).status).toBe(want);
      expect(
        (
          await problemPatchRoute(
            req("/x", json({ status: "resolved" }, { cookie: who?.cookie, method: "PATCH" })),
            p({ id }),
          )
        ).status,
      ).toBe(want);
      expect((await usersRoute(req("/api/admin/users?q=a", as(who)), none)).status).toBe(want);
      expect(
        (
          await userPatchRoute(
            req("/x", json({ roles: ["admin"] }, { cookie: who?.cookie, method: "PATCH" })),
            p({ id }),
          )
        ).status,
      ).toBe(want);
    }
    // a self-service role change can't make anyone an admin
    expect(
      (await enableRoute(req("/x", json({ roles: ["admin"] }, { cookie: renter.cookie })), none)).status,
    ).toBe(400);
    const [u] = await t.sql<{ roles: string[] }[]>`SELECT roles FROM users WHERE id = ${renter.id}`;
    expect(u.roles).not.toContain("admin");
  });

  it("the RC queue: approve sets 'RC checked', reject asks for a new photo, only pending ones are reviewable", async () => {
    const admin = await makeUser(["admin"]);
    const owner = await makeUser(["owner"]);
    const m1 = await makeMachine(owner.id);
    const m2 = await makeMachine(owner.id);
    const m3 = await makeMachine(owner.id);
    await upload(owner, m1, "rc");
    await upload(owner, m2, "rc");
    const q = await (await adminGet(admin)).json();
    const queued = q.rc.map((r: { machineId: string }) => r.machineId);
    expect(queued).toEqual(expect.arrayContaining([m1, m2]));
    expect(queued).not.toContain(m3);
    expect(q.rc.find((r: { machineId: string }) => r.machineId === m1)).toMatchObject({
      owner: expect.any(String),
      rcUrl: expect.stringMatching(/^\/api\/uploads\//),
    });
    expect((await reviewRc(admin, m1, "checked")).status).toBe(200);
    expect((await reviewRc(admin, m2, "rejected")).status).toBe(200);
    expect((await reviewRc(admin, m3, "checked")).status).toBe(409); // no RC uploaded
    expect((await reviewRc(admin, m1, "maybe")).status).toBe(400);
    expect((await reviewRc(admin, "not-a-uuid", "checked")).status).toBe(404);
    const rows = await t.sql<
      { id: string; rc_status: string }[]
    >`SELECT id, rc_status FROM machines WHERE id IN ${t.sql([m1, m2, m3])}`;
    expect(Object.fromEntries(rows.map((r) => [r.id, r.rc_status]))).toEqual({
      [m1]: "checked",
      [m2]: "rejected",
      [m3]: "none",
    });
    const after = await (await adminGet(admin)).json();
    expect(after.rc.map((r: { machineId: string }) => r.machineId)).not.toContain(m1);
    // a new RC photo after a rejection puts it back in the queue
    await upload(owner, m2, "rc");
    const [again] = await t.sql<{ rc_status: string }[]>`SELECT rc_status FROM machines WHERE id = ${m2}`;
    expect(again.rc_status).toBe("pending");
  });

  it("problem reports: listed with booking code, type and photos; resolve with a note; hostile notes are cleaned or refused", async () => {
    const admin = await makeUser(["admin"]);
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const bk = await (await book(renter, m, 41)).json();
    const fd = new FormData();
    fd.set("type", "broke_down");
    fd.set("text", "<script>alert(1)</script> engine stopped");
    await problemRoute(
      req(`/api/bookings/${bk.id}/problems`, {
        method: "POST",
        body: fd,
        headers: { cookie: renter.cookie },
      }),
      p({ id: bk.id }),
    );
    const list = (await (await adminGet(admin)).json()).problems as {
      id: string;
      code: string;
      type: string;
      status: string;
      text: string;
      reporter: string;
    }[];
    const mine = list.find((x) => x.code === bk.code)!;
    expect(mine).toMatchObject({ type: "broke_down", status: "open" });
    expect(mine.text).toContain("<script>"); // stored as text; React escapes it on the page
    const patch = (body: unknown) =>
      problemPatchRoute(req("/x", json(body, { cookie: admin.cookie, method: "PATCH" })), p({ id: mine.id }));
    expect((await patch({ status: "resolved", note: "Called both.\u0000" })).status).toBe(200);
    const [row] = await t.sql<
      { status: string; note: string }[]
    >`SELECT status, note FROM problem_reports WHERE id = ${mine.id}`;
    expect(row).toEqual({ status: "resolved", note: "Called both." });
    expect((await patch({ status: "open" })).status).toBe(200);
    expect((await patch({ status: "closed" })).status).toBe(400);
    expect((await patch({ status: "resolved", note: "x".repeat(2000) })).status).toBe(400);
    expect((await patch({ status: "resolved", extra: 1 })).status).toBe(400);
    expect(
      (
        await problemPatchRoute(
          req("/x", json({ status: "resolved" }, { cookie: admin.cookie, method: "PATCH" })),
          p({ id: crypto.randomUUID() }),
        )
      ).status,
    ).toBe(404);
  });

  it("users: search treats % and _ literally; roles can be changed but never emptied, and an admin can't drop their own admin", async () => {
    const admin = await makeUser(["admin"]);
    const target = await makeUser(["renter"], { email: "find.me.m5@test.local" });
    const search = async (q: string) =>
      (await (await usersRoute(req(`/api/admin/users?q=${encodeURIComponent(q)}`, as(admin)), none)).json())
        .items as {
        id: string;
        roles: string[];
      }[];
    expect((await search("find.me.m5")).map((u) => u.id)).toEqual([target.id]);
    expect(await search("%")).toEqual([]);
    expect(await search("_")).toEqual([]);
    expect((await usersRoute(req("/api/admin/users?q=" + "x".repeat(200), as(admin)), none)).status).toBe(
      400,
    );
    const setRoles = (id: string, roles: unknown) =>
      userPatchRoute(req("/x", json({ roles }, { cookie: admin.cookie, method: "PATCH" })), p({ id }));
    expect((await setRoles(target.id, ["renter", "owner"])).status).toBe(200);
    const [u] = await t.sql<{ roles: string[] }[]>`SELECT roles FROM users WHERE id = ${target.id}`;
    expect(u.roles).toEqual(["renter", "owner"]);
    expect((await setRoles(target.id, [])).status).toBe(400);
    expect((await setRoles(target.id, ["god"])).status).toBe(400);
    expect((await setRoles(target.id, ["owner", "owner"])).status).toBe(200);
    expect((await setRoles(admin.id, ["renter"])).status).toBe(409);
    expect((await setRoles(crypto.randomUUID(), ["renter"])).status).toBe(404);
  });
});

describe("RC photo bookkeeping", () => {
  it("a new RC replaces the old one; deleting it clears the review status", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id);
    await upload(owner, m, "rc");
    const second = await (await upload(owner, m, "rc")).json();
    const rcs = await t.sql`SELECT id FROM machine_photos WHERE machine_id = ${m} AND kind = 'rc'`;
    expect(rcs).toHaveLength(1);
    await t.sql`UPDATE machines SET rc_status = 'checked' WHERE id = ${m}`;
    await upload(owner, m, "rc"); // a different RC after approval needs a new review
    expect((await t.sql`SELECT rc_status FROM machines WHERE id = ${m}`)[0].rc_status).toBe("pending");
    const { DELETE } = await import("@/app/api/owner/machines/[id]/photos/[photoId]/route");
    const now = (await t.sql`SELECT id FROM machine_photos WHERE machine_id = ${m} AND kind = 'rc'`)[0].id;
    expect(second.id).not.toBe(now);
    const r = await DELETE(
      req("/x", { method: "DELETE", headers: { cookie: owner.cookie } }),
      p({ id: m, photoId: now }),
    );
    expect(r.status).toBe(204);
    expect((await t.sql`SELECT rc_status FROM machines WHERE id = ${m}`)[0].rc_status).toBe("none");
  });
});
