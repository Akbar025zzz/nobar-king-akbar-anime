import crypto from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Attaches a request id to every request. The id is echoed in the response
 * header and included in every error payload for traceability.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const headerValue = req.headers["x-request-id"];
  const incoming = typeof headerValue === "string" ? headerValue.trim().slice(0, 64) : "";
  const id = incoming.length > 0 ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
