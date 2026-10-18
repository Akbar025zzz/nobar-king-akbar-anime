import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { loadUser } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { originGuard } from "./middleware/originGuard";
import { requestIdMiddleware } from "./middleware/requestId";
import { apiRouter } from "./routes";

function corsOrigins(): string[] {
  const origins = new Set<string>();
  origins.add(env.frontendUrl);
  for (const origin of env.corsOrigins) {
    origins.add(origin);
  }
  return Array.from(origins);
}

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins().includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(originGuard);
  app.use(loadUser);

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
