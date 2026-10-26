// @vitest-environment node
// Listing CRUD, photos, blocked days, notifications and problem reports, with ownership checks.
import { GET as listMine, POST as createRoute } from "@/app/api/owner/machines/route";
import { DELETE as deleteRoute, PATCH as patchRoute } from "@/app/api/owner/machines/[id]/route";
import { PUT as blocksRoute } from "@/app/api/owner/machines/[id]/blocks/route";
import { POST as photoRoute } from "@/app/api/owner/machines/[id]/photos/route";
import { DELETE as photoDeleteRoute } from "@/app/api/owner/machines/[id]/photos/[photoId]/route";
import { POST as bookRoute } from "@/app/api/bookings/route";
import { POST as problemRoute } from "@/app/api/bookings/[id]/problems/route";
import { GET as notifRoute } from "@/app/api/notifications/route";
import { POST as readRoute } from "@/app/api/notifications/read/route";
import { GET as uploadRoute } from "@/app/api/uploads/[name]/route";
import { inDays, json, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.drop();
});

const p = <P>(x: P) => ({ params: Promise.resolve(x) });
const none = p<Record<string, never>>({});
const listing = {
  category: "tractor",
  make: "Swaraj",
  model: "744 FE",
  hp: 48,
  year: 2018,
  attachments: ["plough", "trolley"],
  lat: 18.41,
  lng: 76.57,
  village: "Latur",
  pin: "413512",
  priceUnit: "acre",
  priceRupees: 1400,
};
const create = (u: TestUser, body: unknown = listing) =>
  createRoute(req("/api/owner/machines", json(body, { cookie: u.cookie })), none);
const patch = (u: TestUser, id: string, body: unknown) =>
  patchRoute(req(`/api/owner/machines/${id}`, json(body, { cookie: u.cookie, method: "PATCH" })), p({ id }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
function upload(u: TestUser, id: string, bytes: Uint8Array<ArrayBuffer>, kind = "front", type = "image/png") {
  const fd = new FormData();
  fd.set("photo", new File([bytes], "x.png", { type }));
  fd.set("kind", kind);
  return photoRoute(
    req(`/api/owner/machines/${id}/photos`, { method: "POST", body: fd, headers: { cookie: u.cookie } }),
    p({ id }),
  );
}

describe("listing CRUD", () => {
  it("only owners can list; price stored in paise; renters get 403", async () => {
    const renter = await makeUser(["renter"]);
    expect((await create(renter)).status).toBe(403);
    const owner = await makeUser(["owner"]);
    const r = await create(owner);
    expect(r.status).toBe(201);
    const { id } = await r.json();
    const [m] = await t.sql<
      { price_paise: number; is_sample: boolean }[]
    >`SELECT price_paise, is_sample FROM machines WHERE id = ${id}`;
    expect(m).toEqual({ price_paise: 140_000, is_sample: false });
    const mine = await (
      await listMine(req("/api/owner/machines", { headers: { cookie: owner.cookie } }), none)
    ).json();
    expect(mine.items).toHaveLength(1);
  });

  it("another owner can't edit or delete it (404); the owner can pause and move it", async () => {
    const owner = await makeUser(["owner"]);
    const other = await makeUser(["owner"]);
    const { id } = await (await create(owner)).json();
    expect((await patch(other, id, { priceRupees: 1 })).status).toBe(404);
    expect(
      (
        await deleteRoute(
          req(`/api/owner/machines/${id}`, { method: "DELETE", headers: { cookie: other.cookie } }),
          p({ id }),
        )
      ).status,
    ).toBe(404);
    expect((await patch(owner, id, { lat: 18.5 })).status).toBe(400); // lat without lng
    expect(await (await patch(owner, id, { active: false, lat: 18.5, lng: 76.6 })).json()).toEqual({
      id,
      active: false,
    });
    expect((await patch(owner, id, { ownerId: other.id })).status).toBe(400);
  });

  it("delete works until there are bookings; then 409 has_bookings", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const { id } = await (await create(owner)).json();
    const del = () =>
      deleteRoute(
        req(`/api/owner/machines/${id}`, { method: "DELETE", headers: { cookie: owner.cookie } }),
        p({ id }),
      );
    await bookRoute(
      req(
        "/api/bookings",
        json(
          { machineId: id, startDate: inDays(3), endDate: inDays(3), slot: "full", qty: 2 },
          { cookie: renter.cookie, headers: { "idempotency-key": crypto.randomUUID() } },
        ),
      ),
      none,
    );
    expect((await del()).status).toBe(409);
    const { id: id2 } = await (await create(owner)).json();
    expect(
      (
        await deleteRoute(
          req(`/api/owner/machines/${id2}`, { method: "DELETE", headers: { cookie: owner.cookie } }),
          p({ id: id2 }),
        )
      ).status,
    ).toBe(204);
  });

  it("lists a baler, and refuses hostile category values", async () => {
    const owner = await makeUser(["owner"]);
    const baler = {
      ...listing,
      category: "baler",
      make: "Fieldking",
      model: "Square Baler",
      hp: null,
      attachments: [],
      priceUnit: "acre",
    };
    const r = await create(owner, baler);
    expect(r.status).toBe(201);
    const { id } = await r.json();
    const [m] = await t.sql<{ category: string }[]>`SELECT category FROM machines WHERE id = ${id}`;
    expect(m.category).toBe("baler");
    for (const category of ["balers", "BALER", "baler'; DROP TABLE machines; --", ["baler"], null]) {
      expect((await create(owner, { ...baler, category })).status, JSON.stringify(category)).toBe(400);
    }
  });

  it("many owners listing at once all succeed, each seeing only their own", async () => {
    const owners = await Promise.all(Array.from({ length: 12 }, () => makeUser(["owner"])));
    const res = await Promise.all(owners.map((o) => create(o)));
    expect(res.map((r) => r.status)).toEqual(Array(12).fill(201));
    const mine = await Promise.all(
      owners.map(
        async (o) =>
          (await (await listMine(req("/api/owner/machines", { headers: { cookie: o.cookie } }), none)).json())
            .items,
      ),
    );
    expect(mine.every((items: unknown[]) => items.length === 1)).toBe(true);
  });

  it("hostile listing input never 500s", async () => {
    const owner = await makeUser(["owner"]);
    for (const body of [
      { ...listing, priceRupees: 1e308 },
      { ...listing, priceRupees: "१४००" },
      { ...listing, lat: Number.NaN },
      { ...listing, make: "x".repeat(10_000) },
      { ...listing, attachments: "plough" },
      { ...listing, village: "'); DELETE FROM machines; --" },
    ]) {
      expect((await create(owner, body)).status, JSON.stringify(body).slice(0, 80)).toBeLessThan(500);
    }
  });
});

describe("photos (local disk, size/type limits)", () => {
  it("accepts a real PNG, refuses a disguised file, a huge file, and strangers; serves to logged-in users only", async () => {
    const owner = await makeUser(["owner"]);
    const other = await makeUser(["owner"]);
    const { id } = await (await create(owner)).json();
    const ok = await upload(owner, id, PNG);
    expect(ok.status).toBe(201);
    const photo = await ok.json();
    expect(photo.url).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(await t.sql`SELECT 1 FROM uploads`).toHaveLength(1);
    expect(
      (await upload(owner, id, new TextEncoder().encode("<script>alert(1)</script>"), "front", "image/png"))
        .status,
    ).toBe(415);
    expect((await upload(owner, id, new Uint8Array(5 * 1024 * 1024 + 1).fill(0xff))).status).toBe(413);
    expect((await upload(other, id, PNG)).status).toBe(404);
    expect((await upload(owner, id, PNG, "selfie")).status).toBe(400);
    const name = photo.url.split("/").pop();
    const served = await uploadRoute(req(photo.url, { headers: { cookie: other.cookie } }), p({ name }));
    expect(served.headers.get("content-type")).toBe("image/png");
    expect((await uploadRoute(req(photo.url), p({ name }))).status).toBe(401);
    expect(
      (
        await uploadRoute(
          req("/api/uploads/x", { headers: { cookie: owner.cookie } }),
          p({ name: "../../.env" }),
        )
      ).status,
    ).toBe(404);
    const del = await photoDeleteRoute(
      req("/x", { method: "DELETE", headers: { cookie: owner.cookie } }),
      p({ id, photoId: photo.id }),
    );
    expect(del.status).toBe(204);
  });

  it("an RC photo marks the listing pending review (D-12) and stays private", async () => {
    const owner = await makeUser(["owner"]);
    const { id } = await (await create(owner)).json();
    await upload(owner, id, PNG, "rc");
    const [m] = await t.sql<{ rc_status: string }[]>`SELECT rc_status FROM machines WHERE id = ${id}`;
    expect(m.rc_status).toBe("pending");
  });
});

describe("blocked days", () => {
  it("blocks and unblocks; a booked day can't be blocked; others can't touch it", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const { id } = await (await create(owner)).json();
    const put = (u: TestUser, days: string[], blocked: boolean) =>
      blocksRoute(
        req(`/api/owner/machines/${id}/blocks`, json({ days, blocked }, { cookie: u.cookie, method: "PUT" })),
        p({ id }),
      );
    expect((await put(owner, [inDays(5), inDays(6), inDays(5)], true)).status).toBe(200);
    const rows = await t.sql`SELECT day FROM machine_blocks WHERE machine_id = ${id}`;
    expect(rows).toHaveLength(2);
    await put(owner, [inDays(6)], false);
    expect(await t.sql`SELECT day FROM machine_blocks WHERE machine_id = ${id}`).toHaveLength(1);
    await bookRoute(
      req(
        "/api/bookings",
        json(
          { machineId: id, startDate: inDays(8), endDate: inDays(8), slot: "morning", qty: 1 },
          { cookie: renter.cookie, headers: { "idempotency-key": crypto.randomUUID() } },
        ),
      ),
      none,
    );
    const clash = await put(owner, [inDays(8)], true);
    expect(clash.status).toBe(409);
    expect(await clash.json()).toMatchObject({ code: "day_booked", day: inDays(8) });
    expect((await put(await makeUser(["owner"]), [inDays(9)], true)).status).toBe(404);
    expect((await put(owner, ["2026-02-30"], true)).status).toBe(400);
  });
});

describe("notifications and problem reports", () => {
  it("the owner is notified of a request, can list and mark read; reports go to the booking's parties only", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const { id } = await (await create(owner)).json();
    const booking = await (
      await bookRoute(
        req(
          "/api/bookings",
          json(
            { machineId: id, startDate: inDays(4), endDate: inDays(4), slot: "full", qty: 3 },
            { cookie: renter.cookie, headers: { "idempotency-key": crypto.randomUUID() } },
          ),
        ),
        none,
      )
    ).json();
    const list = async (u: TestUser) =>
      (await notifRoute(req("/api/notifications", { headers: { cookie: u.cookie } }), none)).json();
    const n = await list(owner);
    expect(n.unread).toBe(1);
    expect(n.items[0]).toMatchObject({ type: "booking_requested", bookingId: booking.id, readAt: null });
    expect((await list(renter)).items).toEqual([]);
    // marking someone else's notification does nothing
    await readRoute(req("/x", json({ ids: [n.items[0].id] }, { cookie: renter.cookie })), none);
    expect((await list(owner)).unread).toBe(1);
    expect(
      await (await readRoute(req("/x", json({ all: true }, { cookie: owner.cookie })), none)).json(),
    ).toEqual({ marked: 1 });
    expect((await list(owner)).unread).toBe(0);

    const report = (u: TestUser, type: string, photos = 0) => {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("text", "Tractor never came");
      for (let i = 0; i < photos; i++) fd.append("photos", new File([PNG], "p.png", { type: "image/png" }));
      return problemRoute(
        req(`/api/bookings/${booking.id}/problems`, {
          method: "POST",
          body: fd,
          headers: { cookie: u.cookie },
        }),
        p({ id: booking.id }),
      );
    };
    expect((await report(renter, "no_show", 2)).status).toBe(201);
    expect((await report(renter, "not_paid")).status).toBe(400); // an owner-only type
    expect((await report(owner, "not_paid")).status).toBe(201);
    expect((await report(await makeUser(), "no_show")).status).toBe(404);
    expect((await report(renter, "no_show", 4)).status).toBe(400);
  });
});
