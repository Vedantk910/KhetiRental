// Throwaway Postgres + PostGIS database per test file. Never touches the dev database's data:
// it is cloned from template_postgis (PostGIS preinstalled, as in the postgis/postgis image).
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { connect, DEFAULT_DATABASE_URL, runMigrations, setConnection } from "../db";

export async function createTestDb() {
  const base = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const name = `kheti_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(base, { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE template_postgis`);
  } finally {
    await admin.end();
  }
  const url = new URL(base);
  url.pathname = `/${name}`;
  const c = connect(url.toString(), 12);
  await runMigrations(c.db);
  setConnection(c);
  return {
    ...c,
    url: url.toString(),
    async drop() {
      await c.sql.end();
      const a = postgres(base, { max: 1, onnotice: () => undefined });
      try {
        // A superuser autovacuum worker can still be on the database; FORCE may not end it, so wait it out.
        for (let attempt = 1; ; attempt++) {
          try {
            await a.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
            break;
          } catch (e) {
            if ((e as { code?: string }).code !== "42501" || attempt === 20) throw e;
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      } finally {
        await a.end();
      }
    },
  };
}
export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
