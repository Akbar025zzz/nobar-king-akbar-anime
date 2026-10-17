import type { FilmKind } from "../../domain/contracts";

/**
 * Public embed providers for films/series, ranked by what actually worked when
 * tested from this deployment (18 Okt 2026):
 *
 *   vidlink.pro     -> resolved to a direct MP4 for BOTH movie and series   [rank 1]
 *   2embed.cc       -> HTTP 200 (candidate, resolved on demand)
 *   multiembed.mov  -> HTTP 200 on the `/?video_id=...&tmdb=1` form
 *
 * Providers that were unreachable from this network (vidsrc.vip, embed.su,
 * player.smashy.stream) are intentionally NOT listed: we only report a server
 * after the resolver proves it can hand back real media.
 */

export interface MovieProviderCandidate {
  server: string;
  label: string;
  embedUrl: string;
}

export function buildProviderCandidates(params: {
  kind: FilmKind;
  tmdbId: string;
  season?: number | null;
  episode?: number | null;
}): MovieProviderCandidate[] {
  const { kind, tmdbId } = params;
  const candidates: MovieProviderCandidate[] = [];

  if (kind === "movie") {
    candidates.push({
      server: "vidlink",
      label: "Server 1 · vidlink",
      embedUrl: `https://vidlink.pro/movie/${tmdbId}`,
    });
    candidates.push({
      server: "2embed",
      label: "Server 2 · 2embed",
      embedUrl: `https://www.2embed.cc/embed/${tmdbId}`,
    });
    candidates.push({
      server: "multiembed",
      label: "Server 3 · multiembed",
      embedUrl: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
    });
    return candidates;
  }

  const season = params.season ?? 1;
  const episode = params.episode ?? 1;
  candidates.push({
    server: "vidlink",
    label: "Server 1 · vidlink",
    embedUrl: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
  });
  candidates.push({
    server: "2embed",
    label: "Server 2 · 2embed",
    embedUrl: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
  });
  candidates.push({
    server: "multiembed",
    label: "Server 3 · multiembed",
    embedUrl: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
  });
  return candidates;
}

/** Referer yang dipakai provider saat memutar media (beberapa CDN memeriksanya). */
export function providerReferer(embedUrl: string): string | null {
  try {
    const url = new URL(embedUrl);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return null;
  }
}
