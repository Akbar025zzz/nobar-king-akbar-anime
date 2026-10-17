import type { Request, Response } from "express";
import { errors } from "../domain/errors";
import * as contentService from "../services/content.service";
import * as streamService from "../services/stream.service";
import * as streamProxyService from "../services/streamProxy.service";

function pageFrom(req: Request): number {
  const parsed = Number(req.query.page ?? 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export async function getCatalog(req: Request, res: Response): Promise<void> {
  const genre = typeof req.query.genre === "string" ? req.query.genre.trim() : "";
  const result = genre
    ? await contentService.getByGenre(genre, pageFrom(req))
    : await contentService.getCatalog(pageFrom(req));
  res.status(200).json({ status: "success", data: result.items, meta: result.meta });
}

export async function search(req: Request, res: Response): Promise<void> {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    throw errors.invalidRequest("Parameter q wajib diisi.");
  }
  const items = await contentService.searchAnime(query);
  res.status(200).json({ status: "success", data: items, meta: { query, count: items.length } });
}

export async function ongoing(req: Request, res: Response): Promise<void> {
  const result = await contentService.getOngoing(pageFrom(req));
  res.status(200).json({ status: "success", data: result.items, meta: result.meta });
}

export async function complete(req: Request, res: Response): Promise<void> {
  const result = await contentService.getCompleted(pageFrom(req));
  res.status(200).json({ status: "success", data: result.items, meta: result.meta });
}

export async function trending(_req: Request, res: Response): Promise<void> {
  const items = await contentService.getTrending(8);
  res.status(200).json({ status: "success", data: items, meta: { count: items.length } });
}

export async function genres(_req: Request, res: Response): Promise<void> {
  const items = await contentService.getGenres();
  res.status(200).json({ status: "success", data: items, meta: { count: items.length } });
}

/** Jadwal rilis mingguan (terisi untuk sumber oploverz, kosong untuk otakudesu). */
export async function schedule(_req: Request, res: Response): Promise<void> {
  const items = await contentService.getSchedule();
  res.status(200).json({ status: "success", data: items, meta: { count: items.length } });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const anime = await contentService.getAnimeDetail(req.params.id);
  res.status(200).json({ status: "success", data: anime });
}

export async function episodes(req: Request, res: Response): Promise<void> {
  const anime = await contentService.getAnimeDetail(req.params.id);
  res.status(200).json({
    status: "success",
    data: anime.episodes,
    meta: { contentId: anime.id, total: anime.episodes.length },
  });
}

export async function stream(req: Request, res: Response): Promise<void> {
  const resolution = await streamService.resolveEpisodeStream(req.params.id, req.params.episodeId);
  res.status(200).json({ status: "success", data: resolution });
}

/**
 * Signed pass-through proxy for stream bytes (playlists, segments, mp4 ranges).
 * Nothing is stored; only URLs signed by this backend are accepted.
 */
export async function streamProxy(req: Request, res: Response): Promise<void> {
  const encoded = typeof req.query.u === "string" ? req.query.u : "";
  const signature = typeof req.query.s === "string" ? req.query.s : "";
  const url = streamProxyService.decodeProxyRequest(encoded, signature);

  const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
  const upstream = await streamProxyService.openUpstream(url, range);

  if (upstream.status >= 400) {
    upstream.stream.destroy();
    res.status(upstream.status).end();
    return;
  }

  // Playlists are small text documents: buffer, rewrite child URLs, reply.
  if (upstream.playlistHint) {
    const body = await streamProxyService.readBody(upstream.stream);
    if (body.length === 0) {
      res.status(502).end();
      return;
    }
    if (!streamProxyService.looksLikePlaylist(body)) {
      res.setHeader("Content-Type", upstream.contentType || "application/octet-stream");
      res.status(upstream.status).send(body);
      return;
    }
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "private, max-age=5");
    res.status(200).send(streamProxyService.rewritePlaylist(body.toString("utf8"), url));
    return;
  }

  // Media (mp4 ranges, TS segments): pipe the bytes straight through so large
  // open-ended ranges never get buffered in memory.
  res.status(upstream.status);
  res.setHeader("Content-Type", upstream.contentType || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (upstream.contentLength) res.setHeader("Content-Length", upstream.contentLength);
  if (upstream.contentRange) res.setHeader("Content-Range", upstream.contentRange);
  if (upstream.acceptRanges) res.setHeader("Accept-Ranges", upstream.acceptRanges);

  const cleanup = () => {
    upstream.stream.destroy();
  };
  upstream.stream.on("error", () => {
    res.destroy();
  });
  res.on("close", cleanup);
  upstream.stream.pipe(res);
}
