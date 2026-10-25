import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export const DEFAULT_DATABASE_URL = "postgres://kheti:kheti@localhost:5432/kheti";
const MIGRATIONS = path.join(process.cwd(), "server/db/migrations");

interface Conn {
  sql: Sql;
  db: Db;
}

export function connect(url: string, max = 10): Conn {
  // drizzle() makes this client return timestamps as strings, so raw `sql` rows hold strings, not Dates.
  const sql = postgres(url, { max, onnotice: () => undefined });
  return { sql, db: drizzle(sql, { schema }) };
}

// One pool per process; survives dev hot reloads. Connects lazily on the first query.
const G = globalThis as unknown as { __khetiDb?: Conn };
const conn = () => (G.__khetiDb ??= connect(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL));

export const getDb = () => conn().db;
export const getSql = () => conn().sql;

/** Tests point the app at their throwaway database. */
export function setConnection(c: Conn) {
  G.__khetiDb = c;
}

/** The first row, typed as possibly missing. */
export const one = <T>(rows: readonly T[]): T | undefined => rows[0];

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: MIGRATIONS });
}
