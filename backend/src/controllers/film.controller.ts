import type { Request, Response } from "express";
import { errors } from "../domain/errors";
import * as filmService from "../services/film.service";
import * as streamService from "../services/stream.service";

function seasonFrom(req: Request): number | undefined {
  const parsed = Number(req.query.season);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

/** Baris katalog untuk halaman /film. */
export async function rows(_req: Request, res: Response): Promise<void> {
  const items = await filmService.getFilmRows();
  res.status(200).json({
    status: "success",
    data: items,
    meta: { count: items.length, totalItems: items.reduce((sum, row) => sum + row.items.length, 0) },
  });
}

export async function search(req: Request, res: Response): Promise<void> {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    throw errors.invalidRequest("Parameter q wajib diisi.");
  }
  const items = await filmService.searchFilms(query);
  res.status(200).json({ status: "success", data: items, meta: { query, count: items.length } });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const film = await filmService.getFilmDetail(req.params.id, seasonFrom(req));
  res.status(200).json({ status: "success", data: film });
}

export async function episodes(req: Request, res: Response): Promise<void> {
  const film = await filmService.getFilmDetail(req.params.id, seasonFrom(req));
  res.status(200).json({
    status: "success",
    data: film.episodes,
    meta: { contentId: film.id, season: film.activeSeason, total: film.episodes.length },
  });
}

export async function stream(req: Request, res: Response): Promise<void> {
  const resolution = await streamService.resolveEpisodeStream(req.params.id, req.params.episodeId);
  res.status(200).json({ status: "success", data: resolution });
}
