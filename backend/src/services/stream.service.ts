import axios from "axios";
import { buildProviderCandidates, providerReferer } from "../adapters/movieProviders/movieProviders";
import { resolverClient } from "../adapters/resolver/resolver.client";
import { parseFilmContentId, parseFilmEpisodeId } from "../adapters/tmdb/tmdb.adapter";
import {
  oploverzServerName,
  parseContentId,
  rankStreamCandidates,
  toStreamSource,
} from "../adapters/wajik/wajik.adapter";
import { wajikClient } from "../adapters/wajik/wajik.client";
import { env } from "../config/env";
import type { EpisodeStreamResolution, StreamSource } from "../domain/contracts";
import { errors } from "../domain/errors";
import { cached } from "../utils/cache";
import { logger } from "../utils/logger";
import { getEpisodeOrThrow } from "./content.service";
import { getFilmEpisodeOrThrow } from "./film.service";
import { buildProxyUrl } from "./streamProxy.service";

/**
 * Stream pipeline (sub-Indo sources):
 *
 *   otakudesu: episode -> wajik /episode -> ranked mirror servers (720p first)
 *              -> wajik /server -> embed URL -> resolver -> direct mp4/m3u8
 *   oploverz : episode -> wajik /oploverz/episode -> streamingUrl (upbolt.to)
 *              -> resolver -> HLS master playlist
 *
 * Both end in a quick availability check and a signed same-origin proxy URL.
 * No URL guessing and no fake manifests: a source is only reported when the
 * resolved media URL really answers with a video payload.
 */

const MAX_CANDIDATES = 5;

async function verifyStreamUrl(source: StreamSource): Promise<boolean> {
  try {
    if (source.type === "hls") {
      const response = await axios.get<string>(source.url, {
        timeout: 8000,
        responseType: "text",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
        transformResponse: [(data) => data],
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      return typeof response.data === "string" && response.data.includes("#EXTM3U");
    }

    const response = await axios.get(source.url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0", Range: "bytes=0-1024", Accept: "*/*" },
      maxRedirects: 5,
      validateStatus: (status) => status === 200 || status === 206,
    });
    const contentType = String(response.headers["content-type"] ?? "");
    if (response.status === 200 || response.status === 206) {
      // Some CDNs answer with an HTML error page: reject those.
      if (contentType.includes("text/html")) return false;
      return true;
    }
    return false;
  } catch (error) {
    logger.debug("stream verification failed", {
      server: source.server,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function resolveOtakudesuStream(episodeId: string): Promise<StreamSource> {
  const details = await wajikClient.episodeDetails(episodeId);
  if (!details) {
    throw errors.streamNotFound();
  }

  const candidates = rankStreamCandidates(details).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    throw errors.streamNotFound();
  }

  logger.info("resolving stream", {
    source: "otakudesu",
    episodeId,
    candidates: candidates.map((candidate) => `${candidate.quality}/${candidate.server}`),
  });

  for (const candidate of candidates) {
    try {
      const embedUrl = await wajikClient.serverUrl(candidate.serverId);
      if (!embedUrl) continue;

      const resolved = await resolverClient.resolve(embedUrl);
      if (!resolved?.url) continue;

      const source = toStreamSource({
        url: resolved.url,
        server: candidate.server,
        label: `${candidate.quality || "auto"} · ${candidate.server}`,
      });

      if (await verifyStreamUrl(source)) {
        logger.info("stream resolved", {
          episodeId,
          server: candidate.server,
          quality: candidate.quality,
          type: source.type,
        });
        return source;
      }
    } catch (error) {
      logger.debug("candidate failed", {
        episodeId,
        server: candidate.server,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw errors.streamNotFound();
}

/**
 * oploverz menyediakan satu embed per episode (mis. upbolt.to) tanpa daftar
 * mirror, jadi tidak ada kandidat cadangan: kalau resolver gagal, kita laporkan
 * error yang jujur dan bukan URL tebakan.
 */
async function resolveOploverzStream(episodeId: string): Promise<StreamSource> {
  const details = await wajikClient.oploverzEpisodeDetails(episodeId);
  const streamingUrl = details?.streamingUrl?.trim() || null;
  if (!streamingUrl) {
    throw errors.streamNotFound();
  }

  const server = oploverzServerName(streamingUrl);
  logger.info("resolving stream", { source: "oploverz", episodeId, server, embed: streamingUrl });

  const resolved = await resolverClient.resolve(streamingUrl);
  if (!resolved?.url) {
    throw errors.streamNotFound();
  }

  const source = toStreamSource({
    url: resolved.url,
    server,
    label: `Stream · ${server}`,
  });

  if (!(await verifyStreamUrl(source))) {
    throw errors.streamNotFound();
  }

  logger.info("stream resolved", { episodeId, server, type: source.type });
  return source;
}

/**
 * Film & series.
 *
 * Provider embed publik (vidlink, 2embed, multiembed) memutar media di dalam
 * player milik mereka, dan CDN mereka menolak permintaan dari server
 * (terverifikasi: HTTP 428 walaupun memakai UA + Referer browser, bahkan dari
 * dalam Chromium sungguhan). Karena itu film disajikan sebagai **iframe
 * provider** yang diputar di browser pengguna, dan bukan URL media karangan.
 *
 * Konsekuensi yang disampaikan apa adanya di UI: kontrol pemutar (play/pause/
 * seek) berada di provider, sehingga ruang nobar film memakai "mode sinema"
 * (host memilih judul/season/episode + hitung mundur mulai bareng + chat),
 * sementara sinkronisasi otomatis tetap hanya untuk anime.
 */
function resolveFilmStream(contentId: string, episodeId: string): StreamSource[] {
  const parsed = parseFilmContentId(contentId);
  if (!parsed) {
    throw errors.contentNotFound("Id film tidak dikenali.");
  }

  const episodeRef = parsed.kind === "series" ? parseFilmEpisodeId(episodeId) : null;
  if (parsed.kind === "series" && !episodeRef) {
    throw errors.episodeNotFound("Format episode harus seperti s1e3.");
  }

  const candidates = buildProviderCandidates({
    kind: parsed.kind,
    tmdbId: parsed.tmdbId,
    season: episodeRef?.season,
    episode: episodeRef?.episode,
  });

  logger.info("film providers prepared", {
    contentId,
    episodeId,
    providers: candidates.map((candidate) => candidate.server),
  });

  return candidates.map((candidate) => ({
    id: `${candidate.server}-${Math.random().toString(36).slice(2, 10)}`,
    type: "iframe" as const,
    url: candidate.embedUrl,
    proxyUrl: null,
    label: candidate.label,
    server: candidate.server,
  }));
}

export async function resolveEpisodeStream(
  contentId: string,
  episodeId: string
): Promise<EpisodeStreamResolution> {
  // Ensures the content + episode really exist before touching the source.
  const isFilm = parseFilmContentId(contentId) !== null;
  if (isFilm) {
    await getFilmEpisodeOrThrow(contentId, episodeId);
  } else {
    await getEpisodeOrThrow(contentId, episodeId);
  }

  const parsed = parseContentId(contentId);
  const cacheKey = `stream:${contentId}:${episodeId}`;

  const sources = await cached(
    cacheKey,
    env.resolver.streamCacheTtlSeconds,
    async (): Promise<StreamSource[]> => {
      if (isFilm) {
        return resolveFilmStream(contentId, episodeId);
      }
      const single =
        parsed?.source === "oploverz"
          ? await resolveOploverzStream(episodeId)
          : parsed?.source === "otakudesu"
            ? await resolveOtakudesuStream(episodeId)
            : null;
      if (!single) {
        throw errors.streamNotFound("Sumber konten ini belum mendukung pemutaran.");
      }
      return [single];
    }
  );

  // Source CDNs (cdn.odcloud.net, upbolt edge, ...) do not send CORS headers;
  // hand the frontend a signed same-origin proxy URL for playback. Iframe
  // provider (film) dimainkan langsung di browser provider, jadi tanpa proxy.
  const withProxy = sources.map((source) =>
    source.type === "iframe" ? source : { ...source, proxyUrl: buildProxyUrl(source.url) }
  );

  return {
    contentId,
    episodeId,
    sources: withProxy,
    picked: withProxy[0] ?? null,
  };
}
