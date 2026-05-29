import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import postgres from "postgres";
import * as schema from "./schema";
import { join } from "node:path";

type DbClient =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

declare global {
  var __collectionlog_db: DbClient | undefined;
  var __collectionlog_pglite: PGlite | undefined;
}

const MOCK_DB_PATH = join(process.cwd(), "mock.db");

function buildClient(): DbClient {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = postgres(url, { prepare: false });
    return drizzlePg(sql, { schema });
  }

  // PGlite: persisted to ./mock.db, with pg_trgm loaded
  const pg =
    globalThis.__collectionlog_pglite ??
    new PGlite(`file://${MOCK_DB_PATH}`, { extensions: { pg_trgm } });
  globalThis.__collectionlog_pglite = pg;
  return drizzlePglite(pg, { schema });
}

export const db: DbClient = globalThis.__collectionlog_db ?? buildClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__collectionlog_db = db;
}

export { schema };
export const NAMESPACE = process.env.COLLECTIONLOG_NAMESPACE ?? "collectionlog";

/** True when running against the in-process PGlite (no DATABASE_URL). */
export const isMock = !process.env.DATABASE_URL;

/** Raw Postgres-flavored query, works on both drivers. */
export async function rawQuery<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (process.env.DATABASE_URL) {
    const pg = postgres(process.env.DATABASE_URL, { prepare: false });
    const result = await pg.unsafe(sql, params as never);
    return result as unknown as T[];
  }
  const pg = globalThis.__collectionlog_pglite!;
  const res = await pg.query(sql, params);
  return res.rows as T[];
}
