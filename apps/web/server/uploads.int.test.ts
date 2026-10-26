// @vitest-environment node
import { createTestDb, type TestDb } from "./test/pg";
import { readUpload, removeUpload, saveImage } from "./uploads";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.drop());

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const nameOf = (url: string) => url.slice("/api/uploads/".length);

// Hosts like Vercel have no lasting disk, so uploads live in the database.
describe("uploads", () => {
  it("are stored in the database and read back byte for byte, with the sniffed type", async () => {
    const url = await saveImage(new File([PNG], "x.png", { type: "image/png" }));
    expect(url).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(await t.sql`SELECT 1 FROM uploads WHERE name = ${nameOf(url)}`).toHaveLength(1);
    const f = await readUpload(nameOf(url));
    expect(f.type).toBe("image/png");
    expect(new Uint8Array(f.bytes)).toEqual(PNG);
  });

  it("removeUpload deletes it; reading it then is a 404", async () => {
    const url = await saveImage(new File([PNG], "x.png"));
    await removeUpload(url);
    await expect(readUpload(nameOf(url))).rejects.toMatchObject({ status: 404 });
  });

  it("refuses names that aren't ours and ignores foreign urls on remove", async () => {
    await expect(readUpload("../../etc/passwd")).rejects.toMatchObject({ status: 404 });
    await expect(removeUpload("/samples/x.webp")).resolves.toBeUndefined();
  });
});
