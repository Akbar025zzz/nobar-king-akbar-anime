import axios from "axios";
import { env } from "../../config/env";
import { errors, isAppError } from "../../domain/errors";
import { logger } from "../../utils/logger";
import type {
  TmdbPaged,
  TmdbSeasonDetails,
  TmdbTitleDetails,
  TmdbTitleSummary,
  TmdbVideo,
} from "./tmdb.types";

/**
 * TMDb API client.
 *
 * The key stays on the server: the frontend only ever sees normalized film
 * contracts, and every failure is mapped to a structured AppError so the UI can
 * explain what actually happened.
 */

const BASE_URL = "https://api.themoviedb.org/3";

function mapError(error: unknown, path: string): never {
  if (isAppError(error)) throw error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) {
      throw errors.sourceForbidden("Kunci TMDb tidak valid atau sudah dicabut.");
    }
    if (status === 404) {
      throw errors.contentNotFound();
    }
    if (status === 429) {
      throw errors.sourceUnavailable("Kuota TMDb sedang penuh. Coba lagi sebentar.");
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw errors.sourceTimeout("TMDb terlalu lama merespons.");
    }
  }

  logger.warn("tmdb request failed", {
    path,
    message: error instanceof Error ? error.message : String(error),
  });
  throw errors.sourceUnavailable("Tidak dapat menghubungi TMDb.");
}

async function get<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  try {
    const response = await axios.get<T>(`${BASE_URL}${path}`, {
      timeout: env.tmdb.timeoutMs,
      headers: { Accept: "application/json" },
      params: {
        api_key: env.tmdb.apiKey,
        language: env.tmdb.language,
        ...params,
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return response.data;
  } catch (error) {
    return mapError(error, path);
  }
}

export interface DiscoverOptions {
  page?: number;
  sortBy?: string;
  withOriginalLanguage?: string;
  withGenres?: string;
  withoutGenres?: string;
}

/**
 * Trailer dicari tanpa filter bahasa: kalau memakai `language=id-ID`, TMDb
 * sering hanya mengembalikan video berbahasa Indonesia (seringnya kosong),
 * sehingga trailer resmi berbahasa Inggris ikut hilang.
 */
async function withVideos<T extends { videos?: { results?: TmdbVideo[] | null } | null }>(
  kind: "movie" | "tv",
  id: string | number,
  details: T
): Promise<T> {
  try {
    const videos = await get<{ results?: TmdbVideo[] | null }>(`/${kind}/${id}/videos`, {
      language: "en-US",
    });
    details.videos = { results: videos.results ?? [] };
  } catch {
    // Trailer bersifat opsional: detail tetap tampil tanpa video.
  }
  return details;
}

export const tmdbClient = {
  async discoverMovies(options: DiscoverOptions = {}): Promise<TmdbPaged<TmdbTitleSummary>> {
    return get<TmdbPaged<TmdbTitleSummary>>("/discover/movie", {
      page: options.page ?? 1,
      sort_by: options.sortBy ?? "popularity.desc",
      with_original_language: options.withOriginalLanguage,
      with_genres: options.withGenres,
      without_genres: options.withoutGenres,
      include_adult: "false",
      "vote_count.gte": 5,
    });
  },

  async discoverTv(options: DiscoverOptions = {}): Promise<TmdbPaged<TmdbTitleSummary>> {
    return get<TmdbPaged<TmdbTitleSummary>>("/discover/tv", {
      page: options.page ?? 1,
      sort_by: options.sortBy ?? "popularity.desc",
      with_original_language: options.withOriginalLanguage,
      with_genres: options.withGenres,
      without_genres: options.withoutGenres,
      include_adult: "false",
      "vote_count.gte": 5,
    });
  },

  async movieDetails(id: string | number): Promise<TmdbTitleDetails> {
    const details = await get<TmdbTitleDetails>(`/movie/${id}`, { append_to_response: "credits" });
    return withVideos("movie", id, details);
  },

  async tvDetails(id: string | number): Promise<TmdbTitleDetails> {
    const details = await get<TmdbTitleDetails>(`/tv/${id}`, { append_to_response: "credits" });
    return withVideos("tv", id, details);
  },

  async tvSeason(
    id: string | number,
    seasonNumber: number,
    language?: string
  ): Promise<TmdbSeasonDetails> {
    return get<TmdbSeasonDetails>(`/tv/${id}/season/${seasonNumber}`, language ? { language } : {});
  },

  async searchMulti(query: string): Promise<TmdbPaged<TmdbTitleSummary>> {
    return get<TmdbPaged<TmdbTitleSummary>>("/search/multi", {
      query,
      include_adult: "false",
    });
  },

  /** Health probe for /api/health. */
  async ping(): Promise<boolean> {
    try {
      await get<{ images?: unknown }>("/configuration");
      return true;
    } catch {
      return false;
    }
  },
};
