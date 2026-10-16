/**
 * Structured error contract.
 * Every backend error must be serialized as:
 * { status: "error", error: { code, message, details }, requestId }
 */

export const ERROR_CODES = [
  // generic
  "INTERNAL_ERROR",
  "INVALID_REQUEST",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  // source (Anime1V)
  "SOURCE_UNAVAILABLE",
  "SOURCE_TIMEOUT",
  "SOURCE_FORBIDDEN",
  "SOURCE_BAD_RESPONSE",
  "SOURCE_EMPTY",
  "SOURCE_PARSE_ERROR",
  // content
  "CONTENT_NOT_FOUND",
  "CONTENT_UNAVAILABLE",
  "EPISODE_NOT_FOUND",
  "STREAM_NOT_FOUND",
  // rooms
  "ROOM_NOT_FOUND",
  "ROOM_ENDED",
  "ROOM_FULL",
  "ROOM_PRIVATE",
  "NOT_ROOM_MEMBER",
  "NOT_ROOM_HOST",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  INTERNAL_ERROR: 500,
  INVALID_REQUEST: 400,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  SOURCE_UNAVAILABLE: 503,
  SOURCE_TIMEOUT: 504,
  SOURCE_FORBIDDEN: 502,
  SOURCE_BAD_RESPONSE: 502,
  SOURCE_EMPTY: 502,
  SOURCE_PARSE_ERROR: 502,
  CONTENT_NOT_FOUND: 404,
  CONTENT_UNAVAILABLE: 503,
  EPISODE_NOT_FOUND: 404,
  STREAM_NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  ROOM_ENDED: 410,
  ROOM_FULL: 409,
  ROOM_PRIVATE: 403,
  NOT_ROOM_MEMBER: 403,
  NOT_ROOM_HOST: 403,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details: unknown;

  constructor(code: ErrorCode, message: string, details: unknown = null, httpStatus?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus ?? DEFAULT_STATUS[code] ?? 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const errors = {
  invalidRequest: (message = "Permintaan tidak valid.") => new AppError("INVALID_REQUEST", message),
  validation: (message = "Data yang dikirim tidak valid.", details: unknown = null) =>
    new AppError("VALIDATION_ERROR", message, details),
  unauthorized: (message = "Kamu harus masuk terlebih dahulu.") => new AppError("UNAUTHORIZED", message),
  forbidden: (message = "Kamu tidak memiliki akses.") => new AppError("FORBIDDEN", message),
  notFound: (message = "Data tidak ditemukan.") => new AppError("NOT_FOUND", message),
  rateLimited: (message = "Terlalu banyak permintaan. Coba lagi nanti.") => new AppError("RATE_LIMITED", message),
  contentNotFound: (message = "Anime tidak ditemukan.") => new AppError("CONTENT_NOT_FOUND", message),
  episodeNotFound: (message = "Episode tidak ditemukan.") => new AppError("EPISODE_NOT_FOUND", message),
  streamNotFound: (message = "Video episode ini sedang tidak tersedia.") =>
    new AppError("STREAM_NOT_FOUND", message),
  roomNotFound: (message = "Room tidak ditemukan.") => new AppError("ROOM_NOT_FOUND", message),
  roomEnded: (message = "Room sudah berakhir.") => new AppError("ROOM_ENDED", message),
  roomFull: (message = "Room sudah penuh.") => new AppError("ROOM_FULL", message),
  roomPrivate: (message = "Room ini private.") => new AppError("ROOM_PRIVATE", message),
  notRoomHost: (message = "Hanya host yang dapat melakukan aksi ini.") => new AppError("NOT_ROOM_HOST", message),
  notRoomMember: (message = "Kamu bukan peserta room ini.") => new AppError("NOT_ROOM_MEMBER", message),
  sourceUnavailable: (message = "Sumber anime sedang tidak tersedia.") =>
    new AppError("SOURCE_UNAVAILABLE", message),
  sourceTimeout: (message = "Sumber anime terlalu lama merespons.") => new AppError("SOURCE_TIMEOUT", message),
  sourceForbidden: (message = "Sumber anime tidak dapat diakses.") => new AppError("SOURCE_FORBIDDEN", message),
  sourceBadResponse: (message = "Sumber anime mengembalikan respons yang tidak valid.") =>
    new AppError("SOURCE_BAD_RESPONSE", message),
  sourceParse: (message = "Data dari sumber anime tidak dapat diproses.") =>
    new AppError("SOURCE_PARSE_ERROR", message),
  contentUnavailable: (message = "Konten sedang tidak tersedia dari sumber.") =>
    new AppError("CONTENT_UNAVAILABLE", message),
};
