import http from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { runMigrations } from "./database/migrate";
import { pool } from "./database/pool";
import { startMaintenanceJobs } from "./services/stats.service";
import { logger } from "./utils/logger";
import { createSocketServer } from "./websocket/io";

async function main(): Promise<void> {
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);
  startMaintenanceJobs();

  server.listen(env.port, "0.0.0.0", () => {
    logger.info("backend listening", { port: env.port, env: env.nodeEnv });
  });

  const shutdown = (signal: string) => {
    logger.info("shutting down", { signal });
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("failed to start backend", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
