/**
 * Minimal SQL REPL against PGlite (or DATABASE_URL).
 * Useful for poking at mock.db.
 */
import readline from "node:readline";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  let exec: (sql: string) => Promise<{ rows: unknown[] }>;
  let close: () => Promise<void>;

  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { prepare: false });
    exec = async (s) => ({ rows: (await sql.unsafe(s)) as unknown as unknown[] });
    close = async () => {
      await sql.end();
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
    const pg = new PGlite(`file://${join(process.cwd(), "mock.db")}`, { extensions: { pg_trgm } });
    exec = async (s) => pg.query(s);
    close = async () => {
      await pg.close();
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "sql> " });
  rl.prompt();
  rl.on("line", async (line) => {
    const stmt = line.trim();
    if (!stmt) return rl.prompt();
    if (stmt === ".exit" || stmt === "exit" || stmt === "quit") {
      await close();
      rl.close();
      return;
    }
    try {
      const { rows } = await exec(stmt);
      console.table(rows);
    } catch (err) {
      console.error("error:", (err as Error).message);
    }
    rl.prompt();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
