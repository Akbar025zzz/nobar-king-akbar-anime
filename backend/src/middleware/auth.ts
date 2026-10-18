import type { Request, RequestHandler, Response } from "express";
import { env } from "../config/env";
import { errors } from "../domain/errors";
import { authenticate } from "../services/auth.service";
import { logger } from "../utils/logger";

export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(env.session.cookieName, token, {
    httpOnly: true,
    sameSite: env.session.sameSite,
    secure: env.session.secure,
    path: "/",
    maxAge: env.session.ttlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(env.session.cookieName, {
    httpOnly: true,
    sameSite: env.session.sameSite,
    secure: env.session.secure,
    path: "/",
  });
}

/**
 * Loads the session (if any) for every request. Never fails the request:
 * route-level `requireAuth` decides what needs a logged-in user.
 */
export const loadUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = (req.cookies?.[env.session.cookieName] as string | undefined) ?? null;
    req.sessionToken = token;
    req.user = token ? await authenticate(token) : null;
  } catch (error) {
    req.user = null;
    logger.warn("session lookup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(errors.unauthorized());
    return;
  }
  next();
};

export function getSessionCookieName(): string {
  return env.session.cookieName;
}
