/**
 * Minimal structured logger.
 * Emits single-line JSON records. Never logs secrets: passwords, cookies,
 * API keys, session tokens are filtered by key name.
 */

const REDACTED_KEYS = [
  "password",
  "passwordhash",
  "password_hash",
  "cookie",
  "cookies",
  "authorization",
  "token",
  "apitoken",
  "apikey",
  "api_key",
  "session",
  "secret",
];

function sanitize(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.includes(key.toLowerCase())) {
      output[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = sanitize(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

type Level = "info" | "warn" | "error" | "debug";

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...sanitize(meta),
  };
  const line = JSON.stringify(record);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") {
      emit("debug", message, meta);
    }
  },
};
