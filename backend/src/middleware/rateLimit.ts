import type { Request, RequestHandler } from "express";
import { errors } from "../domain/errors";

/**
 * Lightweight in-memory sliding-window rate limiter.
 * Good enough for a single-node deployment; keyed by user id when logged in,
 * otherwise by client ip.
 */

const buckets = new Map<string, number[]>();

function clientKey(req: Request): string {
  if (req.user) {
    return `user:${req.user.id}`;
  }
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return `ip:${forwarded.split(",")[0]?.trim()}`;
  }
  return `ip:${req.ip ?? "unknown"}`;
}

export function rateLimit(options: {
  name: string;
  limit: number;
  windowMs: number;
  by?: (req: Request) => string;
}): RequestHandler {
  return (req, _res, next) => {
    const subject = options.by ? options.by(req) : clientKey(req);
    const key = `${options.name}:${subject}`;
    const now = Date.now();

    const timestamps = (buckets.get(key) ?? []).filter((ts) => now - ts < options.windowMs);
    if (timestamps.length >= options.limit) {
      next(errors.rateLimited());
      return;
    }
    timestamps.push(now);
    buckets.set(key, timestamps);
    next();
  };
}

// periodic cleanup of stale buckets
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of buckets.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < 60 * 60 * 1000);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, fresh);
    }
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();
