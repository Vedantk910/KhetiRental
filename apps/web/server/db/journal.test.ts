import journal from "./migrations/meta/_journal.json";

// The migrator skips any migration whose `when` is not after the last one applied, so a new entry that sorts
// earlier would silently never run on an existing database.
it("migration timestamps strictly increase", () => {
  const when = journal.entries.map((e) => e.when);
  expect(when.every((w, i) => i === 0 || w > when[i - 1])).toBe(true);
});
