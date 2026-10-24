// The e2e server runs against its own database (kheti_e2e), rebuilt for every run; the dev DB is never touched.
import postgres from "postgres";

const base = process.env.DATABASE_URL ?? "postgres://kheti:kheti@localhost:5432/kheti";
export const E2E_DB = "kheti_e2e";
export const E2E_DATABASE_URL = (() => {
  const u = new URL(base);
  u.pathname = `/${E2E_DB}`;
  return u.toString();
})();
export const E2E_AUTH_SECRET = "e2e-only-secret-not-for-production";

export async function onBase(fn: (sql: postgres.Sql) => Promise<unknown>) {
  const sql = postgres(base, { max: 1, onnotice: () => undefined });
  try {
    await fn(sql);
  } finally {
    await sql.end();
  }
}
