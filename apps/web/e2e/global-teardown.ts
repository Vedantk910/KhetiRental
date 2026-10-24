import { E2E_DB, onBase } from "./db";

export default async function globalTeardown() {
  await onBase((sql) => sql.unsafe(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`));
}
