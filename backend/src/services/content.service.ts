import {
  oploverzSlugFromHref,
  parseContentId,
  parseEpisodeNumber,
  toAnimeDetail,
  toAnimeDetailFromOploverz,
  toCardFromCompleted,
  toCardFromOngoing,
  toCardFromOploverz,
  toCardFromOploverzDirectory,
  toCardFromOploverzHome,
  toCardFromOploverzSchedule,
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
 * up automatically. Which source is served depends on CONTENT_SOURCE:
 *
 *   otakudesu - katalog lengkap (ongoing/completed/genre/pencarian)
 *   oploverz  - dipakai untuk deployment yang IP-nya diblokir Cloudflare oleh
 *               otakudesu; menyediakan episode terbaru, direktori A-Z, jadwal
 *               rilis, dan pencarian (tanpa genre & tanpa daftar "Selesai",
 *               karena sumbernya memang tidak menyediakannya - jadi UI harus
 *               menampilkan keadaan kosong, bukan data karangan).
 */

const TTL = env.wajik.cacheTtlSeconds;
const SOURCE = env.content.source;
const isOploverz = SOURCE === "oploverz";

/** Satuan halaman katalog oploverz (direktori A-Z dipecah per halaman). */
const OPLOVERZ_CATALOG_PAGE_SIZE = 60;

export interface ScheduleGroup {
  day: string;
  items: AnimeCard[];
}

async function persistCards(cards: AnimeCard[]): Promise<void> {
  try {
    await upsertContentCards(cards);
  } catch (error) {
    logger.warn("failed to persist content index", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Membuang kartu duplikat (oploverz memuat beberapa episode dari seri sama). */
function dedupeCards(cards: (AnimeCard | null)[]): AnimeCard[] {
  const seen = new Set<string>();
  const result: AnimeCard[] = [];
  for (const card of cards) {
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}

/** Normalisasi judul untuk pencocokan (huruf kecil, tanpa tanda baca). */
function normalizeTitleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Peta judul -> slug dari direktori A-Z.
 *
 * Daftar "episode terbaru" oploverz tidak menyertakan slug seri, dan URL
 * episode tidak selalu identik dengan slug seri (contoh nyata:
 * "ao-ashi-s2-episode-02-subtitle-indonesia" padahal slug serinya
 * "ao-ashi-season-2"), jadi slug dicocokkan lewat judul seri.
 */
async function oploverzSlugMap(): Promise<Map<string, string>> {
  return cached(`oploverz:slugmap`, Math.max(TTL, 1800), async () => {
    const sections = await wajikClient.oploverzDirectory();
    const map = new Map<string, string>();
    for (const section of sections) {
      for (const entry of section.animeList ?? []) {
        const slug = entry.slug ?? oploverzSlugFromHref(entry.href);
        if (!slug || !entry.title) continue;
        map.set(normalizeTitleKey(entry.title), slug);
      }
    }
    return map;
  });
}

/** Direktori A-Z sebagai kartu (dipakai untuk katalog). */
async function oploverzDirectoryCards(): Promise<AnimeCard[]> {
  return cached(`oploverz:directory:cards`, Math.max(TTL, 1800), async () => {
    const sections = await wajikClient.oploverzDirectory();
    const cards = dedupeCards(
      sections.flatMap((section) => (section.animeList ?? []).map(toCardFromOploverzDirectory))
    );
    cards.sort((a, b) => a.title.localeCompare(b.title, "id"));
    return cards;
  });
}

export async function getGenres(): Promise<{ name: string; slug: string }[]> {
  if (isOploverz) {
    return [];
  }
  return cached("genres", Math.max(TTL, 3600), async () => {
    const genres = await wajikClient.genres();
    return toGenreList(genres);
  });
}

export async function getOngoing(page: number): Promise<Paginated<AnimeCard>> {
  const safePage = Math.max(1, page || 1);

  if (isOploverz) {
    return cached(`oploverz:latest:${safePage}`, TTL, async () => {
      const [home, slugMap] = await Promise.all([wajikClient.oploverzHome(), oploverzSlugMap()]);
      const rows = home?.latestRelease?.animeList ?? [];
      const cards = dedupeCards(
        rows.map((row) => {
          const key = normalizeTitleKey(row.seriesName || row.title || "");
          const slug = slugMap.get(key) ?? null;
          return toCardFromOploverzHome(row, slug);
        })
      );
      await persistCards(cards);
      return { items: cards, meta: { page: 1, hasNextPage: false } };
    });
  }

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

  if (isOploverz) {
    // oploverz tidak menyediakan daftar "Selesai": kembalikan kosong apa adanya.
    return { items: [], meta: { page: safePage, hasNextPage: false } };
  }

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

/**
 * Katalog:
 * - otakudesu -> daftar completed (paling lengkap dan berposter)
 * - oploverz  -> direktori A-Z (judul saja; poster tidak tersedia di halaman itu)
 */
export async function getCatalog(page: number): Promise<Paginated<AnimeCard>> {
  const safePage = Math.max(1, page || 1);

  if (!isOploverz) {
    return getCompleted(safePage);
  }

  const cards = await oploverzDirectoryCards();
  const start = (safePage - 1) * OPLOVERZ_CATALOG_PAGE_SIZE;
  const slice = cards.slice(start, start + OPLOVERZ_CATALOG_PAGE_SIZE);
  return {
    items: slice,
    meta: { page: safePage, hasNextPage: start + OPLOVERZ_CATALOG_PAGE_SIZE < cards.length },
  };
}

export async function getByGenre(genreId: string, page: number): Promise<Paginated<AnimeCard>> {
  const safePage = Math.max(1, page || 1);
  const cleanGenre = genreId.trim().toLowerCase();
  if (!cleanGenre) {
    return { items: [], meta: { page: safePage, hasNextPage: false } };
  }
  if (isOploverz) {
    // oploverz tidak menyediakan filter genre.
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

/** Jadwal rilis mingguan (hanya oploverz). */
export async function getSchedule(): Promise<ScheduleGroup[]> {
  if (!isOploverz) {
    return [];
  }
  return cached(`oploverz:schedule`, Math.max(TTL, 1800), async () => {
    const days = await wajikClient.oploverzSchedule();
    return days
      .map((day) => ({
        day: day.day,
        items: dedupeCards((day.animeList ?? []).map(toCardFromOploverzSchedule)),
      }))
      .filter((group) => group.items.length > 0);
  });
}

export async function searchAnime(query: string): Promise<AnimeCard[]> {
  const clean = query.trim();
  if (!clean) {
    return [];
  }

  return cached(`search:${SOURCE}:${clean.toLowerCase()}`, Math.min(TTL, 180), async () => {
    if (isOploverz) {
      const results = await wajikClient.oploverzSearch(clean);
      const cards = dedupeCards(results.map(toCardFromOploverz));
      await persistCards(cards);
      return cards;
    }
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
    if (parsed.source === "oploverz") {
      const raw = await wajikClient.oploverzAnimeDetails(parsed.animeId);
      if (!raw) {
        throw errors.contentNotFound();
      }
      const detail = toAnimeDetailFromOploverz(raw, parsed.animeId);
      await persistCards([detail]);
      return detail;
    }

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
  const probe = slug.slice(0, 8);
  if (probe.length < 4 || !episodeId.includes(probe)) return null;
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
 * "...-episode-3-sub-indo", oploverz with "...-episode-05-subtitle-indonesia"),
 * used when a stored reference needs a number.
 */
export function episodeNumberFromUrl(url: string | null): number | null {
  if (!url) return null;
  const slug = url.split("/").filter(Boolean).pop() ?? "";
  return parseEpisodeNumber(null, slug);
}

export { SOURCE as activeContentSource };
