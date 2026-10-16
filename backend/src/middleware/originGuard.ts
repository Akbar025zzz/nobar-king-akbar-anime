import type { RequestHandler } from "express";
import { env } from "../config/env";
import { errors } from "../domain/errors";

/**
 * CSRF hardening for state-changing requests.
 * - same-origin requests (host === origin host) are always allowed
 * - requests from configured frontend origins are allowed
 * - requests without an Origin/Referer (curl, server-to-server) are allowed
 * - everything else is rejected
 */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string) => {
    try {
      hosts.add(new URL(value).host);
    } catch {
      // ignore malformed configuration values
    }
  };
  add(env.frontendUrl);
  for (const origin of env.corsOrigins) {
    add(origin);
  }
  return hosts;
}

export const originGuard: RequestHandler = (req, _res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const source = req.headers.origin ?? req.headers.referer;
  if (!source || typeof source !== "string") {
    next();
    return;
  }

  try {
    const sourceUrl = new URL(source);
    const requestHost = req.headers.host ?? "";
    if (sourceUrl.host === requestHost || allowedHosts().has(sourceUrl.host)) {
      next();
      return;
    }
  } catch {
    // fall through to rejection
  }

  next(errors.forbidden("Permintaan lintas situs ditolak."));
};
