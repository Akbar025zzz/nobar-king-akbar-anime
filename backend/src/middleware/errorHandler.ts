import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, isAppError } from "../domain/errors";
import { logger } from "../utils/logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    status: "error",
    error: {
      code: "NOT_FOUND",
      message: "Endpoint tidak ditemukan.",
      details: null,
    },
    requestId: req.requestId,
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = isAppError(error)
    ? error
    : new AppError("INTERNAL_ERROR", "Terjadi kesalahan internal.");

  if (isAppError(error)) {
    logger.warn("request failed", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      code: appError.code,
      status: appError.httpStatus,
      message: appError.message,
    });
  } else {
    logger.error("unhandled error", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : undefined,
    });
  }

  if (res.headersSent) {
    return;
  }

  res.status(appError.httpStatus).json({
    status: "error",
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details ?? null,
    },
    requestId: req.requestId,
  });
};
