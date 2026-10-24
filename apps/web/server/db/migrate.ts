// `npm run db:migrate`: applies server/db/migrations to DATABASE_URL.
import { connect, DEFAULT_DATABASE_URL, runMigrations } from "./index";

const c = connect(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL, 1);
runMigrations(c.db)
  .then(() => {
    console.info("Migrations applied.");
  })
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void c.sql.end();
  });
