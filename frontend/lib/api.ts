import type { PaginatedMeta } from "./types";

/**
 * API access:
 * - browser: same-origin ("" base) so it works behind the gateway and through
 *   Next.js rewrites in development; cookies included automatically.
 * - server components: direct internal URL (no CORS, no public round-trip).
 */

const SERVER_BASE = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";
const CLIENT_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId?: string;

  constructor(message: string, code: string, status: number, details: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

interface Envelope<T> {
  status: "success" | "error";
  data?: T;
  meta?: unknown;
  error?: { code?: string; message?: string; details?: unknown };
  requestId?: string;
}

function resolveBase(server?: boolean): string {
  if (server) return SERVER_BASE;
  return CLIENT_BASE;
}

/**
 * Dynamic route params arrive percent-encoded when the id contains reserved
 * characters (`otakudesu:one-piece` -> `otakudesu%3Aone-piece`), so decode
 * defensively before using them in API paths and links.
 */
export function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function parse<T>(response: Response): Promise<Envelope<T>> {
  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.status === "error" || !payload) {
    const code = payload?.error?.code ?? "INTERNAL_ERROR";
    const message =
      payload?.error?.message ??
      (response.status === 429
        ? "Terlalu banyak permintaan. Coba lagi sebentar."
        : "Terjadi kesalahan. Coba lagi.");
    throw new ApiError(message, code, response.status, payload?.error?.details ?? null, payload?.requestId);
  }
  return payload;
}

export interface ApiOptions {
  server?: boolean;
  revalidate?: number;
  cache?: RequestCache;
}

/**
 * Server-side memo cache for successful payloads only.
 *
 * Next's Data Cache would happily store a transient 404/500 and keep serving
 * it after the backend recovered, so API reads always run with `no-store` and
 * this small in-process memo provides the "revalidate" behaviour instead.
 */
interface MemoEntry {
  expiresAt: number;
  payload: unknown;
}

const memo = new Map<string, MemoEntry>();
const MEMO_MAX_ENTRIES = 300;

function memoKey(base: string, path: string): string {
  return `${base}${path}`;
}

function memoGet<T>(key: string): T | null {
  const hit = memo.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memo.delete(key);
    return null;
  }
  return hit.payload as T;
}

function memoSet(key: string, payload: unknown, ttlSeconds: number): void {
  if (memo.size >= MEMO_MAX_ENTRIES) {
    memo.clear();
  }
  memo.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, payload });
}

export async function apiGet<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const base = resolveBase(options.server);
  const useMemo = Boolean(options.server && options.revalidate);
  const key = memoKey(base, path);

  if (useMemo) {
    const cached = memoGet<T>(key);
    if (cached !== null) return cached;
  }

  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    cache: options.cache ?? "no-store",
  });
  const payload = await parse<T>(response);
  if (useMemo) {
    memoSet(key, payload.data, options.revalidate as number);
  }
  return payload.data as T;
}

export async function apiGetWithMeta<T>(
  path: string,
  options: ApiOptions = {}
): Promise<{ data: T; meta: PaginatedMeta | null }> {
  const base = resolveBase(options.server);
  const useMemo = Boolean(options.server && options.revalidate);
  const key = memoKey(base, `meta:${path}`);

  if (useMemo) {
    const cached = memoGet<{ data: T; meta: PaginatedMeta | null }>(key);
    if (cached !== null) return cached;
  }

  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    cache: options.cache ?? "no-store",
  });
  const payload = await parse<T>(response);
  const result = { data: payload.data as T, meta: (payload.meta as PaginatedMeta) ?? null };
  if (useMemo) {
    memoSet(key, result, options.revalidate as number);
  }
  return result;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${resolveBase(false)}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await parse<T>(response);
  return payload.data as T;
}

export const apiPost = <T>(path: string, body?: unknown) => apiSend<T>(path, "POST", body);
export const apiDelete = <T>(path: string) => apiSend<T>(path, "DELETE");

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Coba lagi.";
}
