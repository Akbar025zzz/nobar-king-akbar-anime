import dotenv from "dotenv";

dotenv.config();

function readString(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

function readInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: readString("NODE_ENV", "development"),
  port: readInt("PORT", 4000),

  frontendUrl: readString("FRONTEND_URL", "http://localhost:3000"),
  corsOrigins: readString("CORS_ORIGINS", "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  databaseUrl: readString(
    "DATABASE_URL",
    "postgres://nobar:nobar_dev_password@127.0.0.1:5432/nobar_king"
  ),

  session: {
    cookieName: readString("SESSION_COOKIE_NAME", "nka_session"),
    ttlDays: readInt("SESSION_TTL_DAYS", 30),
  },

  // Content source: self-hosted wajik-anime-api (sub-Indo scrapers).
  wajik: {
    baseUrl: readString("WAJIK_API_URL", "http://127.0.0.1:4200"),
    timeoutMs: readInt("WAJIK_TIMEOUT_MS", 60000),
    cacheTtlSeconds: readInt("WAJIK_CACHE_TTL", 300),
  },

  // Embed resolver: the vendored anime1v-api Puppeteer engine (/resolve).
  resolver: {
    baseUrl: readString("RESOLVER_API_URL", "http://127.0.0.1:4100/api/v1/anime"),
    apiKey: readString("RESOLVER_API_KEY", "nobar-internal-dev-key"),
    timeoutMs: readInt("RESOLVER_TIMEOUT_MS", 120000),
    streamCacheTtlSeconds: readInt("STREAM_CACHE_TTL", 600),
  },

  streamProxy: {
    // HMAC secret for the signed same-origin stream proxy (pass-through only).
    secret: readString("STREAM_PROXY_SECRET", "nobar-local-stream-proxy-secret"),
  },

  rateLimits: {
    loginPer15Min: readInt("RATE_LIMIT_LOGIN", 10),
    registerPerHour: readInt("RATE_LIMIT_REGISTER", 5),
    searchPerMin: readInt("RATE_LIMIT_SEARCH", 60),
    streamPerMin: readInt("RATE_LIMIT_STREAM", 30),
    createRoomPerHour: readInt("RATE_LIMIT_CREATE_ROOM", 10),
    chatPerMinute: readInt("RATE_LIMIT_CHAT_PER_MINUTE", 30),
  },

  rooms: {
    inactiveCleanupHours: readInt("ROOM_INACTIVE_CLEANUP_HOURS", 12),
    maxParticipants: readInt("MAX_ROOM_PARTICIPANTS", 50),
  },

  isProduction: readString("NODE_ENV", "development") === "production",
};

export type AppEnv = typeof env;
