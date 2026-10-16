import axios from "axios";
import { resolverClient } from "../adapters/resolver/resolver.client";
import { parseContentId, rankStreamCandidates, toStreamSource } from "../adapters/wajik/wajik.adapter";
import { wajikClient } from "../adapters/wajik/wajik.client";
import { env } from "../config/env";
import type { EpisodeStreamResolution, StreamSource } from "../domain/contracts";
import { errors } from "../domain/errors";
import { cached } from "../utils/cache";
import { logger } from "../utils/logger";
import { getEpisodeOrThrow } from "./content.service";
import { buildProxyUrl } from "./streamProxy.service";

/**
 * Stream pipeline (sub-Indo sources):
 *
 *   episode -> wajik /episode -> ranked mirror servers (720p first)
 *   -> wajik /server -> embed URL (desustream / vidhide / ...)
 *   -> resolver service (real browser) -> direct mp4/m3u8
 *   -> quick availability check -> signed same-origin proxy URL for playback
 *
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

export async function resolveEpisodeStream(
  contentId: string,
  episodeId: string
): Promise<EpisodeStreamResolution> {
  // Ensures the content + episode really exist before touching the source.
  await getEpisodeOrThrow(contentId, episodeId);

  const parsed = parseContentId(contentId);
  const cacheKey = `stream:${contentId}:${episodeId}`;

  const picked = await cached(cacheKey, env.resolver.streamCacheTtlSeconds, async () => {
    if (!parsed || parsed.source === "otakudesu") {
      return resolveOtakudesuStream(episodeId);
    }
    throw errors.streamNotFound("Sumber konten ini belum mendukung pemutaran.");
  });

  // Source CDNs (cdn.odcloud.net, googlevideo, ...) do not send CORS headers;
  // hand the frontend a signed same-origin proxy URL for playback.
  const withProxy: StreamSource = { ...picked, proxyUrl: buildProxyUrl(picked.url) };

  return {
    contentId,
    episodeId,
    sources: [withProxy],
    picked: withProxy,
  };
}
