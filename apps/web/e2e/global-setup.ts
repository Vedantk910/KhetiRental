import { connect, runMigrations } from "../server/db";
import { seed } from "../server/db/seed";
import { E2E_DATABASE_URL, E2E_DB, onBase } from "./db";

export default async function globalSetup() {
  await onBase(async (sql) => {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`);
    await sql.unsafe(`CREATE DATABASE ${E2E_DB} TEMPLATE template_postgis`);
  });
  const c = connect(E2E_DATABASE_URL, 2);
  try {
    await runMigrations(c.db);
    await seed(c.sql);
  } finally {
    await c.sql.end();
  }
}
