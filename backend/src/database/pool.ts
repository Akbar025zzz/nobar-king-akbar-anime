import { Pool, PoolClient } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (error) => {
  logger.error("unexpected postgres pool error", { message: error.message });
});

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const started = Date.now();
  const result = await pool.query(text, params as never[]);
  logger.debug("db query", { duration: Date.now() - started, rows: result.rowCount });
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
