import axios, { type AxiosRequestConfig } from "axios";
import { env } from "../../config/env";
import { AppError, errors, isAppError } from "../../domain/errors";
import { logger } from "../../utils/logger";
import type {
  OtakudesuAnimeDetails,
  OtakudesuCompletedAnime,
  OtakudesuEpisodeDetails,
  OtakudesuGenreRef,
  OtakudesuOngoingAnime,
  OtakudesuSearchAnime,
  OtakudesuServerDetails,
  OploverzAnime,
  OploverzAnimeDetails,
  OploverzEpisodeDetails,
  WajikEnvelope,
  WajikPagination,
} from "./wajik.types";

/**
 * HTTP client for the self-hosted wajik-anime-api.
 *
 * The API scrapes sub-Indo sites live, so every call is a fresh scrape on the
 * source side (the API itself caches for ~10 minutes). otakudesu requests are
 * served through a real browser by the vendored API and can therefore take a
 * few seconds; the client uses generous timeouts and maps every transport
 * problem to a structured AppError.
 */

export interface WajikPage<T> {
  items: T;
  pagination: WajikPagination | null;
}

function mapTransportError(error: unknown, path: string): AppError {
  if (isAppError(error)) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return errors.sourceTimeout(`Sumber anime terlalu lama merespons (${path}).`);
    }
    if (status === 403) {
      return errors.sourceForbidden(`Sumber anime menolak permintaan (${path}).`);
    }
    if (status === 404) {
      return errors.contentNotFound();
    }
    if (status && status >= 500) {
      return errors.sourceUnavailable(`Sumber anime sedang bermasalah (${path}).`);
    }
    if (!error.response) {
      return errors.sourceUnavailable(`Tidak dapat menghubungi sumber anime (${path}).`);
    }
  }

  logger.warn("wajik request failed", {
    path,
    message: error instanceof Error ? error.message : String(error),
  });
  return errors.sourceBadResponse();
}

async function request<T>(
  path: string,
  config: AxiosRequestConfig = {}
): Promise<WajikEnvelope<T>> {
  const url = `${env.wajik.baseUrl}${path}`;
  try {
    const response = await axios.get<WajikEnvelope<T>>(url, {
      timeout: env.wajik.timeoutMs,
      headers: { Accept: "application/json", "User-Agent": "nobar-king-akbar/1.0" },
      validateStatus: (status) => status >= 200 && status < 300,
      ...config,
    });

    const body = response.data;
    if (!body || typeof body !== "object" || typeof body.statusCode !== "number") {
      throw errors.sourceBadResponse();
    }
    if (body.statusCode >= 400) {
      throw mapTransportError(
        Object.assign(new Error(body.statusMessage || "source error"), {
          response: { status: body.statusCode },
          isAxiosError: true,
        }),
        path
      );
    }
    return body;
  } catch (error) {
    throw mapTransportError(error, path);
  }
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export const wajikClient = {
  /* ------------------------------- otakudesu ------------------------------- */

  async ongoing(page = 1): Promise<WajikPage<OtakudesuOngoingAnime[]>> {
    const body = await request<{ animeList: OtakudesuOngoingAnime[] }>(
      `/otakudesu/ongoing?page=${Math.max(1, page)}`
    );
    return { items: body.data?.animeList ?? [], pagination: body.pagination ?? null };
  },

  async completed(page = 1): Promise<WajikPage<OtakudesuCompletedAnime[]>> {
    const body = await request<{ animeList: OtakudesuCompletedAnime[] }>(
      `/otakudesu/completed?page=${Math.max(1, page)}`
    );
    return { items: body.data?.animeList ?? [], pagination: body.pagination ?? null };
  },

  async genres(): Promise<OtakudesuGenreRef[]> {
    const body = await request<{ genreList: OtakudesuGenreRef[] }>(`/otakudesu/genre`);
    return body.data?.genreList ?? [];
  },

  async byGenre(genreId: string, page = 1): Promise<WajikPage<OtakudesuSearchAnime[]>> {
    const body = await request<{ animeList: OtakudesuSearchAnime[] }>(
      `/otakudesu/genre/${encode(genreId)}?page=${Math.max(1, page)}`
    );
    return { items: body.data?.animeList ?? [], pagination: body.pagination ?? null };
  },

  async search(query: string): Promise<OtakudesuSearchAnime[]> {
    const body = await request<{ animeList: OtakudesuSearchAnime[] }>(
      `/otakudesu/search?q=${encode(query)}`
    );
    return body.data?.animeList ?? [];
  },

  async animeDetails(animeId: string): Promise<OtakudesuAnimeDetails | null> {
    const body = await request<{ details: OtakudesuAnimeDetails }>(
      `/otakudesu/anime/${encode(animeId)}`
    );
    return body.data?.details ?? null;
  },

  async episodeDetails(episodeId: string): Promise<OtakudesuEpisodeDetails | null> {
    const body = await request<{ details: OtakudesuEpisodeDetails }>(
      `/otakudesu/episode/${encode(episodeId)}`
    );
    return body.data?.details ?? null;
  },

  async serverUrl(serverId: string): Promise<string | null> {
    const body = await request<{ details: OtakudesuServerDetails }>(
      `/otakudesu/server/${encode(serverId)}`
    );
    return body.data?.details?.url ?? null;
  },

  /* -------------------------------- oploverz -------------------------------- */

  async oploverzSearch(query: string): Promise<OploverzAnime[]> {
    const body = await request<{ animeList: OploverzAnime[] }>(
      `/oploverz/search?q=${encode(query)}`
    );
    return body.data?.animeList ?? [];
  },

  async oploverzAnimeDetails(slug: string): Promise<OploverzAnimeDetails | null> {
    const body = await request<{ details: OploverzAnimeDetails }>(
      `/oploverz/anime/${encode(slug)}`
    );
    return body.data?.details ?? null;
  },

  async oploverzEpisodeDetails(episodeId: string): Promise<OploverzEpisodeDetails | null> {
    const body = await request<{ details: OploverzEpisodeDetails }>(
      `/oploverz/episode/${encode(episodeId)}`
    );
    return body.data?.details ?? null;
  },

  /** Health probe used by /api/health. */
  async ping(): Promise<boolean> {
    try {
      await axios.get(`${env.wajik.baseUrl}/otakudesu`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },
};
