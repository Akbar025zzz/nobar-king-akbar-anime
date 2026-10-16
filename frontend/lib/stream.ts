import type { StreamSource } from "./types";

/**
 * Source CDNs frequently omit CORS headers, so direct browser fetches fail.
 * The backend signs a same-origin proxy URL for every resolved source — use it
 * for playback whenever available.
 */
export function playableSource(source: StreamSource | null | undefined): StreamSource | null {
  if (!source) return null;
  if (source.proxyUrl) {
    return { ...source, url: source.proxyUrl };
  }
  return source;
}
