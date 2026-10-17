import {
  parseFilmContentId,
  parseFilmEpisodeId,
  toFilmCard,
  toFilmDetail,
  toFilmEpisodes,
} from "../adapters/tmdb/tmdb.adapter";
import { tmdbClient } from "../adapters/tmdb/tmdb.client";
import type {
  FilmCard,
  FilmDetail,
  FilmEpisode,
  FilmKind,
  FilmRow,
} from "../domain/contracts";
import { env } from "../config/env";
import { errors } from "../domain/errors";
import { upsertContentCards } from "../repositories/content.repo";
import { cached } from "../utils/cache";
import { logger } from "../utils/logger";

/**
 * Film & series service backed by TMDb.
 *
 * Baris katalog diambil dari endpoint `discover` (bukan data contoh), detail
 * memuat kredit pemain + trailer, dan untuk series daftar episode per season
 * dibaca dari `/tv/:id/season/:n`.
 */

const TTL = env.tmdb.cacheTtlSeconds;

interface RowDefinition {
  key: string;
  title: string;
  kind: FilmKind;
  language?: string;
  /** Genre TMDb yang wajib ada (mis. 18 = Drama). */
  withGenres?: string;
  /** Genre TMDb yang dibuang (reality show, talkshow, berita). */
  withoutGenres?: string;
}

const ROW_DEFINITIONS: RowDefinition[] = [
  { key: "film-indonesia", title: "Film Indonesia", kind: "movie", language: "id" },
  { key: "film-populer", title: "Film Populer", kind: "movie" },
  {
    key: "drakor",
    title: "Drama Korea",
    kind: "series",
    language: "ko",
    withGenres: "18",
    withoutGenres: "10764,10767,10763",
  },
  {
    key: "dracin",
    title: "Drama China",
    kind: "series",
    language: "zh",
    withGenres: "18",
    withoutGenres: "10764,10767,10763",
  },
];

async function persistCards(cards: (FilmCard | FilmDetail)[]): Promise<void> {
  try {
    await upsertContentCards(
      cards.map((card) => ({
        source: card.source,
        id: card.id,
        sourceUrl: null,
        title: card.title,
        posterUrl: card.posterUrl,
        backdropUrl: card.backdropUrl,
        status: null,
        year: card.year,
        score: card.score,
        genres: card.genres,
      }))
    );
  } catch (error) {
    logger.warn("failed to persist film index", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function discover(row: RowDefinition, page = 1): Promise<FilmCard[]> {
  const response =
    row.kind === "movie"
      ? await tmdbClient.discoverMovies({
          page,
          withOriginalLanguage: row.language,
          withGenres: row.withGenres,
          withoutGenres: row.withoutGenres,
        })
      : await tmdbClient.discoverTv({
          page,
          withOriginalLanguage: row.language,
          withGenres: row.withGenres,
          withoutGenres: row.withoutGenres,
        });

  return (response.results ?? [])
    .map((item) => toFilmCard(item, row.kind))
    .filter((card) => Boolean(card.posterUrl || card.backdropUrl));
}

/** Baris katalog halaman /film (hanya baris yang benar-benar punya data). */
export async function getFilmRows(): Promise<FilmRow[]> {
  return cached("film:rows", Math.max(TTL, 900), async () => {
    const rows = await Promise.all(
      ROW_DEFINITIONS.map(async (row) => ({
        key: row.key,
        title: row.title,
        items: await discover(row),
      }))
    );

    const withData = rows.filter((row) => row.items.length > 0);
    // Persist di belakang layar: kalau gagal, katalog tetap tampil dari TMDb.
    void persistCards(withData.flatMap((row) => row.items));
    return withData;
  });
}

export async function searchFilms(query: string): Promise<FilmCard[]> {
  const clean = query.trim();
  if (!clean) return [];

  return cached(`film:search:${clean.toLowerCase()}`, Math.min(TTL, 300), async () => {
    const response = await tmdbClient.searchMulti(clean);
    const cards: FilmCard[] = [];
    for (const item of response.results ?? []) {
      if (item.media_type === "movie") cards.push(toFilmCard(item, "movie"));
      else if (item.media_type === "tv") cards.push(toFilmCard(item, "series"));
    }
    return cards.filter((card) => Boolean(card.posterUrl || card.backdropUrl)).slice(0, 24);
  });
}

/**
 * Detail film/series. Untuk series, daftar episode diambil dari season yang
 * diminta (default: season pertama yang punya episode).
 */
export async function getFilmDetail(contentId: string, seasonNumber?: number): Promise<FilmDetail> {
  const parsed = parseFilmContentId(contentId);
  if (!parsed) {
    throw errors.contentNotFound("Id film tidak dikenali.");
  }

  const { kind, tmdbId } = parsed;
  const cacheKey = `film:detail:${contentId}:${seasonNumber ?? "default"}`;

  return cached(cacheKey, TTL, async () => {
    const raw =
      kind === "movie"
        ? await tmdbClient.movieDetails(tmdbId)
        : await tmdbClient.tvDetails(tmdbId);

    const detail = toFilmDetail(raw, kind);
    void persistCards([detail]);

    if (kind !== "series") {
      return detail;
    }

    const requested =
      seasonNumber && detail.seasons.some((season) => season.season === seasonNumber)
        ? seasonNumber
        : (detail.seasons[0]?.season ?? 1);
    detail.activeSeason = requested;

    try {
      const season = await tmdbClient.tvSeason(tmdbId, requested);
      let episodes = toFilmEpisodes(season);

      // TMDb kadang hanya punya judul generik ("Episode 3") untuk bahasa id-ID;
      // kalau semua episode generik, ambil versi aslinya supaya tetap informatif.
      const genericCount = episodes.filter(
        (episode) => !episode.title || /^episode\s*\d+$/i.test(episode.title)
      ).length;
      if (episodes.length > 0 && genericCount === episodes.length) {
        try {
          const fallback = await tmdbClient.tvSeason(tmdbId, requested, "en-US");
          episodes = toFilmEpisodes(fallback);
        } catch {
          // tetap pakai versi pertama
        }
      }

      detail.episodes = episodes;
    } catch (error) {
      logger.warn("film season fetch failed", {
        contentId,
        season: requested,
        message: error instanceof Error ? error.message : String(error),
      });
      detail.episodes = [];
    }

    return detail;
  });
}

/**
 * Validasi episode sebelum stream disentuh.
 * Film diwakili satu "episode" tetap (`movie`) supaya alur ruang nobar seragam.
 */
export async function getFilmEpisodeOrThrow(
  contentId: string,
  episodeId: string
): Promise<{ detail: FilmDetail; episode: FilmEpisode }> {
  const parsed = parseFilmContentId(contentId);
  if (!parsed) {
    throw errors.contentNotFound("Id film tidak dikenali.");
  }

  if (parsed.kind === "movie") {
    const detail = await getFilmDetail(contentId);
    return {
      detail,
      episode: {
        id: "movie",
        season: 0,
        number: 0,
        title: detail.title,
        overview: detail.overview,
        stillUrl: detail.backdropUrl,
        airDate: detail.releaseDate,
        runtimeMinutes: detail.runtimeMinutes,
      },
    };
  }

  const episodeRef = parseFilmEpisodeId(episodeId);
  if (!episodeRef) {
    throw errors.episodeNotFound("Format episode harus seperti s1e3.");
  }

  const detail = await getFilmDetail(contentId, episodeRef.season);
  const episode =
    detail.episodes.find((item) => item.id === episodeId.toLowerCase()) ??
    detail.episodes.find((item) => item.number === episodeRef.episode);

  if (!episode) {
    throw errors.episodeNotFound();
  }

  return { detail, episode };
}

/** Episode pertama yang bisa diputar (dipakai tombol "Tonton" di kartu film). */
export function firstPlayableEpisodeId(detail: FilmDetail): string {
  if (detail.kind === "movie") return "movie";
  return detail.episodes[0]?.id ?? "s1e1";
}
