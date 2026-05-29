/**
 * Run SQL migrations against PGlite (mock.db) or DATABASE_URL.
 * Idempotent — uses CREATE ... IF NOT EXISTS / CREATE OR REPLACE.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "src", "db", "migrations");

async function run() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { prepare: false });
    for (const file of files) {
      const ddl = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] ${file} → DATABASE_URL`);
      await sql.unsafe(ddl);
    }
    await sql.end();
    return;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const pg = new PGlite(`file://${join(process.cwd(), "mock.db")}`, { extensions: { pg_trgm } });
  for (const file of files) {
    const ddl = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrate] ${file} → mock.db`);
    await pg.exec(ddl);
  }
  await pg.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
