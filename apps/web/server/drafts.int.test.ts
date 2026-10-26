// @vitest-environment node
// Server-side listing drafts (UI-SPEC §4.11). Adversarial: logged out and renters, one owner against another,
// forged photo urls, hostile fields, parallel saves and attaches, replays, leftovers after publish.
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DELETE as draftDelete, GET as draftGet, PUT as draftPut } from "@/app/api/owner/draft/route";
import { POST as draftPhotoPost } from "@/app/api/owner/draft/photos/route";
import { DELETE as draftPhotoDelete } from "@/app/api/owner/draft/photos/[key]/route";
import { POST as createRoute } from "@/app/api/owner/machines/route";
import { POST as photoRoute } from "@/app/api/owner/machines/[id]/photos/route";
import { GET as uploadRoute } from "@/app/api/uploads/[name]/route";
import { deleteAccount } from "./account";
import { getSql } from "./db";
import { json, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
let uploads: string;
beforeAll(async () => {
  t = await createTestDb();
  uploads = await mkdtemp(path.join(tmpdir(), "kheti-drafts-"));
  process.env.UPLOAD_DIR = uploads;
});
afterAll(async () => {
  await rm(uploads, { recursive: true, force: true });
  await t.drop();
});

const p = <P>(x: P) => ({ params: Promise.resolve(x) });
const none = p<Record<string, never>>({});
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const owner = () => makeUser(["owner"]);

const data = { category: "tractor", make: "swaraj", model: "744 FE", hp: "48", year: "2018", price: "1400" };
const save = (u: TestUser | null, body: unknown) =>
  draftPut(req("/api/owner/draft", json(body, { cookie: u?.cookie, method: "PUT" })), none);
const load = async (u: TestUser | null) => {
  const res = await draftGet(req("/api/owner/draft", { headers: u ? { cookie: u.cookie } : {} }), none);
  return { status: res.status, body: (await res.json()) as { draft: Record<string, unknown> | null } };
};
const drop = (u: TestUser | null) =>
  draftDelete(req("/api/owner/draft", { method: "DELETE", headers: u ? { cookie: u.cookie } : {} }), none);
const putPhoto = (u: TestUser | null, key: string, bytes: Uint8Array<ArrayBuffer> = PNG) => {
  const fd = new FormData();
  fd.set("photo", new File([bytes], "x.png", { type: "image/png" }));
  fd.set("key", key);
  return draftPhotoPost(
    req("/api/owner/draft/photos", { method: "POST", body: fd, headers: u ? { cookie: u.cookie } : {} }),
    none,
  );
};
const rmPhoto = (u: TestUser | null, key: string) =>
  draftPhotoDelete(
    req(`/api/owner/draft/photos/${key}`, { method: "DELETE", headers: u ? { cookie: u.cookie } : {} }),
    p({ key }),
  );
const urlOf = async (res: Response) => ((await res.json()) as { url: string }).url;
const serve = (u: TestUser, url: string) =>
  uploadRoute(req(url, { headers: { cookie: u.cookie } }), p({ name: url.split("/").pop()! }));
const listing = {
  category: "tractor",
  make: "Swaraj",
  model: "744 FE",
  hp: 48,
  year: 2018,
  attachments: [],
  lat: 18.41,
  lng: 76.57,
  village: "Latur",
  pin: "413512",
  priceUnit: "acre",
  priceRupees: 1400,
  active: false,
};
const newMachine = async (u: TestUser) =>
  (
    (await (
      await createRoute(req("/api/owner/machines", json(listing, { cookie: u.cookie })), none)
    ).json()) as { id: string }
  ).id;
const attach = (u: TestUser, id: string, fromDraft: string) =>
  photoRoute(req(`/api/owner/machines/${id}/photos`, json({ fromDraft }, { cookie: u.cookie })), p({ id }));
const files = async () => (await readdir(uploads)).length;

describe("who may use drafts", () => {
  it("logged out is 401 everywhere; a renter is 403", async () => {
    const r = await makeUser(["renter"]);
    for (const who of [null, r]) {
      const want = who ? 403 : 401;
      expect((await load(who)).status).toBe(want);
      expect((await save(who, { step: 1, data })).status).toBe(want);
      expect((await drop(who)).status).toBe(want);
      expect((await putPhoto(who, "front")).status).toBe(want);
      expect((await rmPhoto(who, "front")).status).toBe(want);
    }
  });
});

describe("saving and restoring", () => {
  it("round-trips the fields and the step; one draft per owner, a new save replaces it", async () => {
    const u = await owner();
    expect((await load(u)).body.draft).toBeNull();
    expect((await save(u, { step: 2, data })).status).toBe(200);
    expect((await save(u, { step: 3, data: { ...data, model: "Second" } })).status).toBe(200);
    const { body } = await load(u);
    expect(body.draft).toMatchObject({ step: 3, data: { ...data, model: "Second" }, photos: {} });
    const rows = await getSql()`SELECT 1 FROM listing_drafts WHERE owner_id = ${u.id}`;
    expect(rows).toHaveLength(1);
  });

  it("is invisible to other owners (no id is ever taken from the request)", async () => {
    const a = await owner();
    const b = await owner();
    await save(a, { step: 2, data: { ...data, model: "A-secret" } });
    expect((await load(b)).body.draft).toBeNull();
    await save(b, { step: 1, data: { ...data, model: "B" } });
    expect((await load(a)).body.draft).toMatchObject({ data: { model: "A-secret" } });
    expect((await save(b, { step: 1, data, ownerId: a.id })).status).toBe(400);
    expect((await load(a)).body.draft).toMatchObject({ data: { model: "A-secret" } });
  });

  it("rejects forged and hostile bodies", async () => {
    const u = await owner();
    const bad: unknown[] = [
      {},
      null,
      [],
      { step: 0, data },
      { step: 5, data },
      { step: 1.5, data },
      { step: "2", data },
      { step: 1, data, photos: { front: "/api/uploads/x.png" } },
      { step: 1, data: { ...data, photos: {} } },
      { step: 1, data: { ...data, category: "rocket" } },
      { step: 1, data: { ...data, lat: 999, lng: 0 } },
      { step: 1, data: { ...data, model: "x".repeat(61) } },
      { step: 1, data: { ...data, model: "a\u0000b" } },
      { step: 1, data: { ...data, attachments: ["plough", "nuke"] } },
      { step: 1, data: { ...data, blocked: Array.from({ length: 71 }, () => "2030-01-01") } },
      { step: 1, data: { ...data, blocked: ["not-a-day"] } },
      { step: 1, data: { ...data, price: 1400 } },
      { step: 1, data: { ...data, lastServiced: "2020-13-45x" } },
    ];
    for (const b of bad) expect((await save(u, b)).status, JSON.stringify(b).slice(0, 80)).toBe(400);
    const huge = await draftPut(
      req(
        "/api/owner/draft",
        json({ step: 1, data: { ...data, place: "y".repeat(20_000) } }, { cookie: u.cookie, method: "PUT" }),
      ),
      none,
    );
    expect(huge.status).toBe(400);
    expect((await load(u)).body.draft).toBeNull();
  });

  it("parallel saves leave exactly one row holding one complete save", async () => {
    const u = await owner();
    const res = await Promise.all(
      Array.from({ length: 20 }, (_, i) => save(u, { step: (i % 4) + 1, data: { ...data, model: `M${i}` } })),
    );
    expect(res.every((r) => r.status === 200)).toBe(true);
    const rows = await getSql()<
      { step: number; data: { model: string } }[]
    >`SELECT step, data FROM listing_drafts WHERE owner_id = ${u.id}`;
    expect(rows).toHaveLength(1);
    expect((Number(rows[0].data.model.slice(1)) % 4) + 1).toBe(rows[0].step);
  });

  it("limits how often a draft can be saved", async () => {
    const u = await owner();
    await getSql()`INSERT INTO rate_limits (key, window_start, count) VALUES (${`draftSave:${u.id}`}, now(), 600)`;
    const res = await save(u, { step: 1, data });
    expect(res.status).toBe(429);
  });

  it("deleting is idempotent", async () => {
    const u = await owner();
    await save(u, { step: 1, data });
    expect((await drop(u)).status).toBe(200);
    expect((await drop(u)).status).toBe(200);
    expect((await load(u)).body.draft).toBeNull();
  });
});

describe("draft photos", () => {
  it("are stored under the draft, readable only by their owner, and replaced in place", async () => {
    const a = await owner();
    const b = await owner();
    const first = await putPhoto(a, "front");
    expect(first.status).toBe(201);
    const url = await urlOf(first);
    expect(url).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.png$/);
    expect((await load(a)).body.draft).toMatchObject({ photos: { front: url } });
    expect((await serve(a, url)).status).toBe(200);
    expect((await serve(b, url)).status).toBe(404);
    const before = await files();
    const url2 = await urlOf(await putPhoto(a, "front"));
    expect(url2).not.toBe(url);
    expect(await files()).toBe(before);
    expect((await serve(a, url)).status).toBe(404);
  });

  it("refuse unknown keys, non-images and oversized files; nothing is left on disk", async () => {
    const u = await owner();
    const before = await files();
    for (const key of ["", "../etc", "front ", "FRONT", "extra4", "kind", "__proto__"])
      expect((await putPhoto(u, key)).status, key).toBe(400);
    expect((await putPhoto(u, "front", new TextEncoder().encode("<script>alert(1)</script>"))).status).toBe(
      415,
    );
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    expect((await putPhoto(u, "front", big)).status).toBe(413);
    expect(await files()).toBe(before);
  });

  it("removing one deletes the file; removing a missing one is fine", async () => {
    const u = await owner();
    const before = await files();
    const url = await urlOf(await putPhoto(u, "side"));
    expect(await files()).toBe(before + 1);
    expect((await rmPhoto(u, "side")).status).toBe(200);
    expect((await rmPhoto(u, "side")).status).toBe(200);
    expect(await files()).toBe(before);
    expect((await load(u)).body.draft).toMatchObject({ photos: {} });
    expect((await serve(u, url)).status).toBe(404);
    expect((await rmPhoto(u, "nope")).status).toBe(400);
  });

  it("deleting the draft deletes its photos, and deleting the account does too", async () => {
    const u = await owner();
    const before = await files();
    await putPhoto(u, "front");
    await putPhoto(u, "rc");
    await drop(u);
    expect(await files()).toBe(before);
    const v = await owner();
    await putPhoto(v, "front");
    await deleteAccount({ id: v.id, name: null, email: null, phone: null, roles: ["owner"] });
    expect(await files()).toBe(before);
    expect(await getSql()`SELECT 1 FROM listing_drafts WHERE owner_id = ${v.id}`).toHaveLength(0);
  });
});

describe("publishing: attaching draft photos to the machine", () => {
  it("moves them to the machine with the right kinds, once, and the owner's draft keeps nothing", async () => {
    const u = await owner();
    const urls: Record<string, string> = {};
    for (const k of ["front", "side", "meter", "extra2", "rc"]) urls[k] = await urlOf(await putPhoto(u, k));
    const id = await newMachine(u);
    for (const k of Object.keys(urls)) expect((await attach(u, id, k)).status, k).toBe(201);
    const rows = await getSql()<
      { url: string; kind: string }[]
    >`SELECT url, kind FROM machine_photos WHERE machine_id = ${id} ORDER BY sort`;
    expect(rows.map((r) => r.kind)).toEqual(["front", "side", "meter", "extra", "rc"]);
    expect(rows.map((r) => r.url)).toEqual(Object.values(urls));
    expect((await getSql()`SELECT rc_status FROM machines WHERE id = ${id}`)[0].rc_status).toBe("pending");
    expect((await load(u)).body.draft).toMatchObject({ photos: {} });
    expect((await attach(u, id, "front")).status).toBe(404);
    // Dropping the draft afterwards must not touch files the machine now owns.
    await drop(u);
    expect((await serve(u, urls.front)).status).toBe(200);
  });

  it("will not attach to someone else's machine, nor with someone else's draft", async () => {
    const a = await owner();
    const b = await owner();
    await putPhoto(a, "front");
    const mine = await newMachine(a);
    const theirs = await newMachine(b);
    expect((await attach(a, theirs, "front")).status).toBe(404);
    expect((await attach(b, mine, "front")).status).toBe(404);
    expect((await load(a)).body.draft).toMatchObject({ photos: { front: expect.any(String) } });
    expect((await attach(a, "not-a-uuid", "front")).status).toBe(404);
    expect((await attach(a, mine, "../x")).status).toBe(400);
  });

  it("racing attaches of one key give exactly one photo", async () => {
    const u = await owner();
    await putPhoto(u, "front");
    const id = await newMachine(u);
    const res = await Promise.all(Array.from({ length: 10 }, () => attach(u, id, "front")));
    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await getSql()`SELECT 1 FROM machine_photos WHERE machine_id = ${id}`).toHaveLength(1);
  });

  it("respects the eight-photo limit", async () => {
    const u = await owner();
    const id = await newMachine(u);
    for (let i = 0; i < 6; i++)
      await getSql()`INSERT INTO machine_photos (machine_id, url, kind, sort) VALUES (${id}, ${`/api/uploads/${crypto.randomUUID()}.png`}, 'extra', ${i})`;
    for (const k of ["front", "side", "meter"]) await putPhoto(u, k);
    const out = await Promise.all(["front", "side", "meter"].map((k) => attach(u, id, k)));
    expect(out.map((r) => r.status).sort()).toEqual([201, 201, 409]);
  });
});
