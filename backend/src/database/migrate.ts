import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool";
import { logger } from "../utils/logger";

/**
 * Simple versioned migration runner.
 * - repeatable: already applied versions are skipped
 * - safe: each migration runs inside a transaction
 * - documented: files live in src/database/migrations
 */
export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
    if (applied.rowCount && applied.rowCount > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      logger.info("migration applied", { version });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info("migrations complete");
      return pool.end();
    })
    .catch((error) => {
      logger.error("migration failed", { message: error instanceof Error ? error.message : String(error) });
      process.exitCode = 1;
    });
}
