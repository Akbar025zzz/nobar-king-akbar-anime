import axios from "axios";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { env } from "../config/env";
import { errors } from "../domain/errors";
import { logger } from "../utils/logger";

/**
 * Signed stream proxy.
 *
 * Several source CDNs (notably the Zilla HLS segments) do not send CORS
 * headers, so the browser cannot fetch them from our origin. This proxy
 * streams the bytes through our own origin — pure pass-through, nothing is
 * stored — and only accepts URLs carrying a valid HMAC signature produced by
 * this backend, so it cannot be abused as an open proxy.
 */

const PROXY_PATH = "/api/stream/proxy";

function secret(): string {
  return env.streamProxy.secret;
}

function signatureFor(url: string): string {
  return crypto.createHmac("sha256", secret()).update(url).digest("base64url").slice(0, 32);
}

export function buildProxyUrl(url: string): string {
  const encoded = Buffer.from(url, "utf8").toString("base64url");
  return `${PROXY_PATH}?u=${encoded}&s=${signatureFor(url)}`;
}

export function decodeProxyRequest(encoded: string, signature: string): string {
  if (!encoded || !signature) {
    throw errors.invalidRequest("Parameter proksi tidak lengkap.");
  }
  let url: string;
  try {
    url = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    throw errors.invalidRequest("Parameter proksi tidak valid.");
  }
  if (!/^https?:\/\//i.test(url)) {
    throw errors.invalidRequest("Parameter proksi tidak valid.");
  }
  const expected = Buffer.from(signatureFor(url));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw errors.invalidRequest("Tanda tangan proksi tidak valid.");
  }
  return url;
}

const UPSTREAM_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "*/*",
  Referer: "https://player.zilla-networks.com/",
  Origin: "https://player.zilla-networks.com",
  // The Zilla CDN rejects segment requests without browser fetch-metadata.
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

export interface UpstreamResult {
  status: number;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: string | null;
  body: Buffer;
}

export async function fetchUpstream(url: string, range?: string): Promise<UpstreamResult> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 25000,
    maxRedirects: 5,
    validateStatus: () => true,
    decompress: false,
    headers: range ? { ...UPSTREAM_HEADERS, Range: range } : UPSTREAM_HEADERS,
  });

  logger.debug("stream proxy upstream", { status: response.status, url: url.slice(0, 120) });

  return {
    status: response.status,
    contentType: String(response.headers["content-type"] ?? ""),
    contentLength:
      response.headers["content-length"] !== undefined ? String(response.headers["content-length"]) : null,
    contentRange:
      response.headers["content-range"] !== undefined ? String(response.headers["content-range"]) : null,
    acceptRanges:
      response.headers["accept-ranges"] !== undefined ? String(response.headers["accept-ranges"]) : null,
    body: Buffer.from(response.data),
  };
}

export interface UpstreamStream {
  status: number;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: string | null;
  /** True when URL/content-type already prove this is an HLS playlist. */
  playlistHint: boolean;
  stream: Readable;
}

/**
 * Opens the upstream response as a live stream.
 *
 * Media files can be hundreds of megabytes and browsers request them with an
 * open range (`Range: bytes=0-`); buffering those in memory both stalls
 * playback and wastes RAM, so the proxy pipes the bytes straight through.
 */
export async function openUpstream(url: string, range?: string): Promise<UpstreamStream> {
  const response = await axios.get<Readable>(url, {
    responseType: "stream",
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: () => true,
    decompress: false,
    headers: range ? { ...UPSTREAM_HEADERS, Range: range } : UPSTREAM_HEADERS,
  });

  const contentType = String(response.headers["content-type"] ?? "");
  const playlistHint = url.includes(".m3u8") || contentType.includes("mpegurl");

  logger.debug("stream proxy upstream opened", {
    status: response.status,
    playlistHint,
    url: url.slice(0, 120),
  });

  return {
    status: response.status,
    contentType,
    contentLength:
      response.headers["content-length"] !== undefined ? String(response.headers["content-length"]) : null,
    contentRange:
      response.headers["content-range"] !== undefined ? String(response.headers["content-range"]) : null,
    acceptRanges:
      response.headers["accept-ranges"] !== undefined ? String(response.headers["accept-ranges"]) : null,
    playlistHint,
    stream: response.data,
  };
}

const MAX_PLAYLIST_BYTES = 8 * 1024 * 1024;

/** Reads a stream fully (used for playlists only). */
export async function readBody(stream: Readable, maxBytes = MAX_PLAYLIST_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    chunks.push(buffer);
    total += buffer.length;
    if (total > maxBytes) break;
  }
  return Buffer.concat(chunks);
}

export function looksLikePlaylist(body: Buffer): boolean {
  return body.subarray(0, 64).toString("utf8").includes("#EXTM3U");
}

/**
 * Reads the first chunk of a stream so unknown content types can be sniffed
 * without losing data: the chunk is returned for the caller to forward.
 */
export async function peekChunk(
  stream: Readable,
  size = 512
): Promise<{ head: Buffer; rest: Readable }> {
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  const head = first.done
    ? Buffer.alloc(0)
    : Buffer.isBuffer(first.value)
      ? first.value
      : Buffer.from(first.value as Uint8Array);

  async function* remainder(): AsyncGenerator<Buffer> {
    for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    }
  }

  if (head.length <= size) {
    return { head, rest: Readable.from(remainder()) };
  }

  const trimmed = head.subarray(size);
  const rest = Readable.from(
    (async function* () {
      yield trimmed;
      yield* remainder();
    })()
  );
  return { head: head.subarray(0, size), rest };
}

export function isPlaylist(url: string, contentType: string, body: Buffer): boolean {
  if (url.includes(".m3u8")) return true;
  if (contentType.includes("mpegurl")) return true;
  return body.subarray(0, 64).toString("utf8").includes("#EXTM3U");
}

function resolveUrl(candidate: string, baseUrl: string): string {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

function rewriteAttributeUris(line: string, baseUrl: string): string {
  return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
    const absolute = resolveUrl(uri, baseUrl);
    return `URI="${buildProxyUrl(absolute)}"`;
  });
}

/**
 * Rewrites a playlist so every child URL (variant playlists, segments, keys,
 * init maps) is fetched through this proxy as well.
 */
export function rewritePlaylist(text: string, baseUrl: string): string {
  return text
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.trim();
      if (line === "") return rawLine;
      if (line.startsWith("#")) {
        if (
          line.startsWith("#EXT-X-KEY") ||
          line.startsWith("#EXT-X-MAP") ||
          line.startsWith("#EXT-X-MEDIA") ||
          line.startsWith("#EXT-X-I-FRAME-STREAM-INF") ||
          line.startsWith("#EXT-X-PART")
        ) {
          return rewriteAttributeUris(rawLine, baseUrl);
        }
        return rawLine;
      }
      return buildProxyUrl(resolveUrl(line, baseUrl));
    })
    .join("\n");
}
