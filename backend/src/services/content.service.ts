import {
  parseContentId,
  parseEpisodeNumber,
  toAnimeDetail,
  toCardFromCompleted,
  toCardFromOngoing,
  toCardFromSearch,
  toGenreList,
} from "../adapters/wajik/wajik.adapter";
import { wajikClient } from "../adapters/wajik/wajik.client";
import { env } from "../config/env";
import type {
  AnimeCard,
  AnimeDetail,
  AnimeEpisode,
  Paginated,
  TrendingEntry,
} from "../domain/contracts";
import { errors } from "../domain/errors";
import { getContentRows, rowToCard, upsertContentCards } from "../repositories/content.repo";
import { trendingStats } from "../repositories/library.repo";
import { cached } from "../utils/cache";
import { logger } from "../utils/logger";

/**
 * Content service backed by the self-hosted wajik-anime-api (sub-Indo).
 *
 * Everything is scraped live from the source, so new episodes and titles show
 * up automatically: the API reads the ongoing/completed lists and each detail
 * page on demand. We only cache briefly (WAJIK_CACHE_TTL, default 5 minutes)
 * to protect the source and keep the UI snappy.
 */

const TTL = env.wajik.cacheTtlSeconds;

async function persistCards(cards: AnimeCard[]): Promise<void> {
  try {
    await upsertContentCards(cards);
  } catch (error) {
    logger.warn("failed to persist content index", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getGenres(): Promise<{ name: string; slug: string }[]> {
  return cached("genres", Math.max(TTL, 3600), async () => {
    const genres = await wajikClient.genres();
    return toGenreList(genres);
  });
}

export async function getOngoing(page: number): Promise<Paginated<AnimeCard>> {
  const safePage = Math.max(1, page || 1);
  return cached(`ongoing:${safePage}`, TTL, async () => {
    const { items, pagination } = await wajikClient.ongoing(safePage);
    const cards = items.map(toCardFromOngoing);
    await persistCards(cards);
    return {
      items: cards,
      meta: { page: pagination?.currentPage ?? safePage, hasNextPage: Boolean(pagination?.hasNextPage) },
    };
  });
}

export async function getCompleted(page: number): Promise<Paginated<AnimeCard>> {
  const safePage = Math.max(1, page || 1);
  return cached(`completed:${safePage}`, TTL, async () => {
    const { items, pagination } = await wajikClient.completed(safePage);
    const cards = items.map(toCardFromCompleted);
    await persistCards(cards);
    return {
      items: cards,
      meta: { page: pagination?.currentPage ?? safePage, hasNextPage: Boolean(pagination?.hasNextPage) },
    };
  });
}

/** Catalog = completed list (the largest poster-bearing paginated list). */
export async function getCatalog(page: number): Promise<Paginated<AnimeCard>> {
  return getCompleted(page);
}

export async function getByGenre(genreId: string, page: number): Promise<Paginated<AnimeCard>> {
  const safePage = Math.max(1, page || 1);
  const cleanGenre = genreId.trim().toLowerCase();
  if (!cleanGenre) {
    return { items: [], meta: { page: safePage, hasNextPage: false } };
  }

  return cached(`genre:${cleanGenre}:${safePage}`, TTL, async () => {
    const { items, pagination } = await wajikClient.byGenre(cleanGenre, safePage);
    const cards = items.map(toCardFromSearch);
    await persistCards(cards);
    return {
      items: cards,
      meta: { page: pagination?.currentPage ?? safePage, hasNextPage: Boolean(pagination?.hasNextPage) },
    };
  });
}

export async function searchAnime(query: string): Promise<AnimeCard[]> {
  const clean = query.trim();
  if (!clean) {
    return [];
  }

  return cached(`search:${clean.toLowerCase()}`, Math.min(TTL, 180), async () => {
    const results = await wajikClient.search(clean);
    const cards = results.map(toCardFromSearch);
    await persistCards(cards);
    return cards;
  });
}

export async function getAnimeDetail(contentId: string): Promise<AnimeDetail> {
  const parsed = parseContentId(contentId);
  if (!parsed) {
    throw errors.contentNotFound();
  }

  return cached(`detail:${contentId}`, TTL, async () => {
    if (parsed.source !== "otakudesu") {
      throw errors.contentNotFound("Sumber konten ini belum didukung untuk detail.");
    }
    const raw = await wajikClient.animeDetails(parsed.animeId);
    if (!raw) {
      throw errors.contentNotFound();
    }
    const detail = toAnimeDetail(raw, parsed.animeId);
    await persistCards([detail]);
    return detail;
  });
}

export async function getEpisodeOrThrow(
  contentId: string,
  episodeId: string
): Promise<{ detail: AnimeDetail; episode: AnimeEpisode }> {
  const detail = await getAnimeDetail(contentId);
  const episode =
    detail.episodes.find((item) => item.id === episodeId) ??
    (await findEpisodeFallback(contentId, episodeId));
  if (!episode) {
    throw errors.episodeNotFound();
  }
  return { detail, episode };
}

/**
 * The episode list is scraped from the detail page; if a room was created for
 * an episode that has since been rotated out of the list, we still accept it
 * when the id belongs to the same anime slug.
 */
async function findEpisodeFallback(
  contentId: string,
  episodeId: string
): Promise<AnimeEpisode | null> {
  const parsed = parseContentId(contentId);
  if (!parsed) return null;
  const slug = parsed.animeId.replace(/-sub-indo$/i, "");
  if (!episodeId.includes(slug.slice(0, 8))) return null;
  return {
    id: episodeId,
    number: parseEpisodeNumber(null, episodeId),
    title: null,
    url: null,
  };
}

/**
 * Trending based exclusively on real internal activity (watch history and
 * Nobar rooms). When there is no activity yet, returns an empty list so the
 * UI can show an honest empty state instead of fake rankings.
 */
export async function getTrending(limit = 8): Promise<TrendingEntry[]> {
  const stats = await trendingStats(14, limit);
  if (stats.length === 0) {
    return [];
  }

  const rows = await getContentRows(stats.map((stat) => stat.content_id));
  const entries: TrendingEntry[] = [];
  let rank = 1;

  for (const stat of stats) {
    const row = rows.get(stat.content_id);
    if (!row) continue;
    entries.push({
      rank,
      anime: rowToCard(row),
      watchers: Number(stat.watchers ?? 0),
      rooms: Number(stat.rooms ?? 0),
    });
    rank += 1;
  }

  return entries;
}

/**
 * Episode number from an episode URL (otakudesu URLs end with
 * "...-episode-3-sub-indo"), used when a stored reference needs a number.
 */
export function episodeNumberFromUrl(url: string | null): number | null {
  if (!url) return null;
  const slug = url.split("/").filter(Boolean).pop() ?? "";
  return parseEpisodeNumber(null, slug);
}
