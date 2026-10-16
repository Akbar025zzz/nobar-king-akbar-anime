import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

/**
 * Client for the embed resolver service (the vendored anime1v-api Puppeteer
 * engine). It turns a player/embed URL into a direct, playable media URL
 * (mp4 or m3u8) by loading the page in a real browser and extracting the
 * stream - including Cloudflare-protected players such as desustream.
 */

export interface ResolverResult {
  url: string;
  mediaType: "hls" | "mp4" | "embed";
  server: string | null;
}

function normalizeMediaType(value: unknown): "hls" | "mp4" | "embed" {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "hls" || raw === "m3u8") return "hls";
  if (raw === "mp4" || raw === "video/mp4") return "mp4";
  return "embed";
}

function isSuccess(value: unknown): boolean {
  return value === true || value === "true" || value === "True" || value === 1;
}

export const resolverClient = {
  async resolve(embedUrl: string): Promise<ResolverResult | null> {
    try {
      const response = await axios.get<{
        success?: unknown;
        streamUrl?: string | null;
        mediaType?: string | null;
        server?: string | null;
        message?: string;
      }>(`${env.resolver.baseUrl}/resolve`, {
        params: { url: embedUrl },
        timeout: env.resolver.timeoutMs,
        headers: {
          Accept: "application/json",
          "X-API-Key": env.resolver.apiKey,
        },
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const body = response.data;
      if (!body || !isSuccess(body.success) || !body.streamUrl) {
        logger.debug("resolver returned no stream", {
          embedUrl,
          message: body?.message ?? "unknown",
        });
        return null;
      }

      return {
        url: body.streamUrl,
        mediaType: normalizeMediaType(body.mediaType),
        server: body.server ?? null,
      };
    } catch (error) {
      logger.debug("resolver request failed", {
        embedUrl,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
};
