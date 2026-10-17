import type {
  AnimeCard,
  AnimeDetail,
  AnimeEpisode,
  ContentSource,
  StreamSource,
  StreamType,
} from "../../domain/contracts";
import type {
  OtakudesuAnimeDetails,
  OtakudesuCompletedAnime,
  OtakudesuEpisodeDetails,
  OtakudesuEpisodeRef,
  OtakudesuGenreRef,
  OtakudesuOngoingAnime,
  OtakudesuSearchAnime,
  OploverzAnime,
  OploverzAnimeDetails,
  OploverzDirectoryEntry,
  OploverzHomeAnime,
} from "./wajik.types";

/**
 * Normalization layer: raw wajik-anime-api payloads -> internal contracts.
 *
 * Content ids are namespaced per source (`otakudesu:<animeId>`), so the id
 * alone is enough to route detail/episode/stream requests later.
 */

export function contentId(source: ContentSource, animeId: string): string {
  return `${source}:${animeId}`;
}

export function parseContentId(rawId: string): { source: ContentSource; animeId: string } | null {
  const separator = rawId.indexOf(":");
  if (separator <= 0) return null;
  const source = rawId.slice(0, separator);
  const animeId = rawId.slice(separator + 1);
  if (!animeId) return null;
  if (source !== "otakudesu" && source !== "oploverz") return null;
  return { source, animeId };
}

/** Best-effort source lookup for rows stored before the namespaced ids. */
export function sourceFromContentId(rawId: string): ContentSource {
  if (rawId.startsWith("tmdb:")) return "tmdb";
  return parseContentId(rawId)?.source ?? "otakudesu";
}

/** Extracts a numeric score from values like "Rating : 8.54" or "6.88". */
export function parseScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStatus(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.replace(/^status\s*:\s*/i, "").trim();
}

export function parseEpisodeNumber(title: string | null, episodeId: string): number | null {
  if (title) {
    const direct = title.trim().match(/^(\d+(?:\.\d+)?)$/);
    if (direct) return Number.parseFloat(direct[1]);
    const embedded = title.match(/(?:episode|ep)\s*(\d+(?:\.\d+)?)/i);
    if (embedded) return Number.parseFloat(embedded[1]);
  }
  const fromId = episodeId.match(/episode-(\d+(?:\.\d+)?)/i);
  if (fromId) return Number.parseFloat(fromId[1]);
  const trailing = episodeId.match(/(\d+)(?:-[a-z]+)?$/i);
  return trailing ? Number.parseFloat(trailing[1]) : null;
}

/**
 * The otakudesu synopsis can be a plain string or `{ paragraphList: [...] }`.
 * Empty paragraph lists must stay null instead of showing "[object Object]".
 */
export function normalizeSynopsis(value: unknown): string | null {
  if (typeof value === "string") {
    const clean = value.trim();
    return clean ? clean : null;
  }
  if (value && typeof value === "object") {
    const paragraphs = (value as { paragraphList?: unknown }).paragraphList;
    if (Array.isArray(paragraphs)) {
      const text = paragraphs
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .join("\n\n");
      return text || null;
    }
  }
  return null;
}

/* ----------------------------------- cards ---------------------------------- */

export function toCardFromOngoing(raw: OtakudesuOngoingAnime): AnimeCard {
  return {
    id: contentId("otakudesu", raw.animeId),
    source: "otakudesu",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: "Ongoing",
    year: null,
    score: null,
    kind: null,
    genres: [],
    sourceUrl: raw.otakudesuUrl ?? null,
  };
}

export function toCardFromCompleted(raw: OtakudesuCompletedAnime): AnimeCard {
  return {
    id: contentId("otakudesu", raw.animeId),
    source: "otakudesu",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: "Completed",
    year: null,
    score: parseScore(raw.score),
    kind: null,
    genres: [],
    sourceUrl: raw.otakudesuUrl ?? null,
  };
}

export function toCardFromSearch(raw: OtakudesuSearchAnime): AnimeCard {
  return {
    id: contentId("otakudesu", raw.animeId),
    source: "otakudesu",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: parseStatus(raw.status),
    year: null,
    score: parseScore(raw.score),
    kind: null,
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    sourceUrl: raw.otakudesuUrl ?? null,
  };
}

export function toCardFromOploverz(raw: OploverzAnime): AnimeCard | null {
  const slug = raw.slug ?? null;
  if (!slug) return null;
  return {
    id: contentId("oploverz", slug),
    source: "oploverz",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: parseStatus(raw.status),
    year: null,
    score: null,
    kind: raw.type ?? null,
    genres: [],
    sourceUrl: raw.href ?? null,
  };
}

export function toCardFromDetail(raw: OtakudesuAnimeDetails, animeId: string): AnimeCard {
  return {
    id: contentId("otakudesu", animeId),
    source: "otakudesu",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: parseStatus(raw.status),
    year: null,
    score: parseScore(raw.score),
    kind: raw.type ?? null,
    genres: (raw.genreList ?? []).map((genre) => genre.title),
    sourceUrl: null,
  };
}

export function toEpisodesFromDetail(raw: OtakudesuAnimeDetails): AnimeEpisode[] {
  return (raw.episodeList ?? []).map((episode: OtakudesuEpisodeRef) => ({
    id: episode.episodeId,
    number: parseEpisodeNumber(episode.title, episode.episodeId),
    title: episode.title ?? null,
    url: episode.otakudesuUrl ?? null,
  }));
}

export function toAnimeDetail(raw: OtakudesuAnimeDetails, animeId: string): AnimeDetail {
  const card = toCardFromDetail(raw, animeId);
  const episodes = toEpisodesFromDetail(raw);
  return {
    ...card,
    id: contentId("otakudesu", animeId),
    description: normalizeSynopsis(raw.synopsis),
    titleJapanese: raw.japanese ?? null,
    totalEpisodes:
      typeof raw.episodes === "number"
        ? raw.episodes
        : typeof raw.episodes === "string" && raw.episodes.trim()
          ? Number.parseInt(raw.episodes, 10) || null
          : episodes.length || null,
    startDate: raw.aired ?? null,
    endDate: null,
    votes: null,
    trailerUrl: null,
    episodes,
  };
}

export function toGenreList(genres: OtakudesuGenreRef[]): { name: string; slug: string }[] {
  return genres
    .filter((genre) => genre.genreId && genre.title)
    .map((genre) => ({ name: genre.title, slug: genre.genreId }));
}

/* --------------------------------- streams ---------------------------------- */

export interface StreamCandidate {
  quality: string;
  qualityScore: number;
  server: string;
  serverId: string;
}

/**
 * Reliability order, measured live:
 * - odcdn   -> cdn.odcloud.net (otakudesu's own CDN, direct MP4, fast)
 * - odstream/ondesuhd -> desustream variants (arcg archive.org / googlevideo)
 * - vidhide -> odvidhide.com
 * - mega    -> encrypted, usually not resolvable
 */
const SERVER_PREFERENCE = ["odcdn", "odstream", "ondesuhd", "desustream", "vidhide", "mega", "unknown"];

function serverScore(server: string): number {
  const normalized = server.toLowerCase();
  const index = SERVER_PREFERENCE.findIndex((candidate) => normalized.includes(candidate));
  return index === -1 ? SERVER_PREFERENCE.length : index;
}

export function qualityScore(quality: string): number {
  const match = quality.match(/(\d{3,4})p/);
  if (match) return Number.parseInt(match[1], 10);
  return 0;
}

/**
 * Flattens the mirrorstream structure into a ranked candidate list:
 * higher quality first, then the server preference order.
 */
export function rankStreamCandidates(details: OtakudesuEpisodeDetails): StreamCandidate[] {
  const groups = details.server?.qualityList ?? [];
  const candidates: StreamCandidate[] = [];

  for (const group of groups) {
    const quality = (group.title ?? "").trim();
    for (const server of group.serverList ?? []) {
      if (!server?.serverId || !server?.title) continue;
      candidates.push({
        quality,
        qualityScore: qualityScore(quality),
        server: server.title.trim(),
        serverId: server.serverId,
      });
    }
  }

  return candidates.sort((a, b) => {
    const serverDelta = serverScore(a.server) - serverScore(b.server);
    if (serverDelta !== 0) return serverDelta;
    return b.qualityScore - a.qualityScore;
  });
}

export function streamTypeFromUrl(url: string): StreamType {
  if (/\.m3u8(\?|#|$)/i.test(url) || /m3u8/i.test(url)) return "hls";
  if (/videoplayback|\.mp4(\?|#|$)/i.test(url)) return "mp4";
  return "embed";
}

export function toStreamSource(params: {
  url: string;
  server: string;
  label: string;
  referer?: string | null;
}): StreamSource {
  return {
    id: `${params.server}-${Math.random().toString(36).slice(2, 10)}`,
    type: streamTypeFromUrl(params.url),
    url: params.url,
    proxyUrl: null,
    label: params.label,
    server: params.server,
  };
}

/* --------------------------- oploverz (panel mode) -------------------------- */

/** Akhiran episode pada URL oploverz, mis. "-episode-05-subtitle-indonesia". */
const OPLOVERZ_EPISODE_SUFFIX = /-episode-[a-z0-9]+(?:-subtitle-indonesia)?$/i;

function lastUrlSegment(href: string | null | undefined): string | null {
  if (!href) return null;
  const clean = href.split("?")[0].replace(/\/+$/, "");
  const segment = clean.split("/").filter(Boolean).pop() ?? "";
  return segment || null;
}

/**
 * Slug seri dari sebuah URL oploverz. Halaman detail memakai
 * `/anime/<slug>/`, sedangkan daftar episode memakai URL episode
 * (`/<slug>-episode-05-subtitle-indonesia/`), sehingga akhiran episode
 * perlu dipotong lebih dulu.
 */
export function oploverzSlugFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const segment = lastUrlSegment(href);
  if (!segment) return null;
  if (href.includes("/anime/")) return segment;
  const stripped = segment.replace(OPLOVERZ_EPISODE_SUFFIX, "");
  return stripped || segment;
}

/** Episode id oploverz = segmen terakhir URL episode. */
export function oploverzEpisodeIdFromHref(href: string | null | undefined): string | null {
  return lastUrlSegment(href);
}

/** Nama server embed dari URL-nya, mis. upbolt.to -> "upbolt". */
export function oploverzServerName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host.split(".")[0] || "embed";
  } catch {
    return "embed";
  }
}

function parseYearFromSeason(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/(19|20)\d{2}/);
  return match ? match[0] : null;
}

/** Kartu dari item /oploverz/home (judul seri + poster episode). */
export function toCardFromOploverzHome(
  raw: OploverzHomeAnime,
  slugOverride?: string | null
): AnimeCard | null {
  const slug = slugOverride || oploverzSlugFromHref(raw.href);
  if (!slug) return null;
  return {
    id: contentId("oploverz", slug),
    source: "oploverz",
    type: "anime",
    title: (raw.seriesName || raw.title || "").trim(),
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: parseStatus(raw.status),
    year: null,
    score: parseScore(raw.score),
    kind: raw.type ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    sourceUrl: raw.href ?? null,
  };
}

/** Kartu dari direktori A-Z (sumber tidak menyediakan poster di halaman ini). */
export function toCardFromOploverzDirectory(entry: OploverzDirectoryEntry): AnimeCard | null {
  const slug = entry.slug ?? oploverzSlugFromHref(entry.href);
  if (!slug) return null;
  return {
    id: contentId("oploverz", slug),
    source: "oploverz",
    type: "anime",
    title: entry.title,
    posterUrl: null,
    backdropUrl: null,
    status: null,
    year: null,
    score: null,
    kind: null,
    genres: [],
    sourceUrl: entry.href ?? null,
  };
}

/** Kartu dari jadwal rilis (poster + slug tersedia). */
export function toCardFromOploverzSchedule(raw: OploverzAnime): AnimeCard | null {
  const slug = raw.slug ?? oploverzSlugFromHref(raw.href);
  if (!slug) return null;
  return {
    id: contentId("oploverz", slug),
    source: "oploverz",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: parseStatus(raw.status),
    year: null,
    score: null,
    kind: raw.type ?? null,
    genres: [],
    sourceUrl: raw.href ?? null,
  };
}

export function toAnimeDetailFromOploverz(raw: OploverzAnimeDetails, slug: string): AnimeDetail {
  const episodes: AnimeEpisode[] = (raw.episodeList ?? []).map((episode) => {
    const id = oploverzEpisodeIdFromHref(episode.href) ?? `${slug}-${episode.episode}`;
    return {
      id,
      number: parseEpisodeNumber(episode.episode || episode.title, id),
      title: episode.title || null,
      url: episode.href ?? null,
    };
  });

  return {
    id: contentId("oploverz", slug),
    source: "oploverz",
    type: "anime",
    title: raw.title,
    posterUrl: raw.poster ?? null,
    backdropUrl: null,
    status: parseStatus(raw.status),
    year: parseYearFromSeason(raw.season),
    score: parseScore(raw.rating),
    kind: raw.type ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres.filter(Boolean) : [],
    sourceUrl: null,
    description: normalizeSynopsis(raw.synopsis),
    titleJapanese: null,
    totalEpisodes: episodes.length || null,
    startDate: raw.releasedOn ?? null,
    endDate: raw.updatedOn ?? null,
    votes: null,
    trailerUrl: null,
    episodes,
  };
}
