import type { Request, Response } from "express";
import { z } from "zod";
import { errors } from "../domain/errors";
import { getContentRows, rowToCard } from "../repositories/content.repo";
import * as libraryRepo from "../repositories/library.repo";
import { episodeNumberFromUrl } from "../services/content.service";
import {
  contentUrlOf,
  episodeUrlOf,
  episodesOf,
  resolveContentDetail,
} from "../services/contentResolver";
import { sourceFromContentId } from "../adapters/wajik/wajik.adapter";
import { parseOrThrow } from "../utils/validate";

const favoriteSchema = z.object({
  contentId: z.string().trim().min(1, "contentId wajib diisi.").max(200),
});

const historySchema = z.object({
  contentId: z.string().trim().min(1, "contentId wajib diisi.").max(200),
  episodeId: z.string().trim().min(1).max(200).nullish(),
  position: z.number().min(0).max(86400),
  duration: z.number().min(0).max(86400).nullish(),
});

function requireUser(req: Request) {
  if (!req.user) {
    throw errors.unauthorized();
  }
  return req.user;
}

export async function listFavorites(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const rows = await libraryRepo.listFavorites(user.id);
  const indexRows = await getContentRows(rows.map((row) => row.content_id));

  const data = rows.map((row) => {
    const indexRow = indexRows.get(row.content_id) ?? null;
    return {
      source: sourceFromContentId(row.content_id),
      contentType: "anime",
      contentId: row.content_id,
      contentUrl: row.content_url,
      createdAt: row.created_at.toISOString(),
      anime: indexRow ? rowToCard(indexRow) : null,
      available: indexRow !== null,
    };
  });

  res.status(200).json({ status: "success", data, meta: { count: data.length } });
}

export async function addFavorite(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { contentId } = parseOrThrow(favoriteSchema, req.body ?? {});
  const detail = await resolveContentDetail(contentId);
  await libraryRepo.addFavorite({
    userId: user.id,
    contentId: detail.id,
    contentUrl: contentUrlOf(detail),
  });
  res.status(201).json({ status: "success", data: { contentId: detail.id, favorited: true } });
}

export async function removeFavorite(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const removed = await libraryRepo.removeFavorite(user.id, req.params.contentId);
  res
    .status(200)
    .json({ status: "success", data: { contentId: req.params.contentId, favorited: false, removed } });
}

export async function listHistory(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const rows = await libraryRepo.listHistory(user.id, 40);
  const indexRows = await getContentRows(rows.map((row) => row.content_id));

  const data = rows.map((row) => {
    const indexRow = indexRows.get(row.content_id) ?? null;
    const position = Number(row.position_seconds ?? 0);
    const duration = row.duration_seconds === null ? null : Number(row.duration_seconds);
    const progressPercent =
      duration && duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
    return {
      source: sourceFromContentId(row.content_id),
      contentType: "anime",
      contentId: row.content_id,
      contentUrl: row.content_url,
      episodeId: row.episode_id,
      episodeUrl: row.episode_url,
      episodeNumber: episodeNumberFromUrl(row.episode_url),
      positionSeconds: position,
      durationSeconds: duration,
      progressPercent,
      updatedAt: row.updated_at.toISOString(),
      anime: indexRow ? rowToCard(indexRow) : null,
      available: indexRow !== null,
    };
  });

  res.status(200).json({ status: "success", data, meta: { count: data.length } });
}

export async function recordHistory(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = parseOrThrow(historySchema, req.body ?? {});
  const detail = await resolveContentDetail(input.contentId);
  const episodes = episodesOf(detail);

  let episodeId = input.episodeId ?? null;
  let episodeUrl: string | null = null;

  if (episodeId) {
    const episode = episodes.find((item) => item.id === episodeId);
    if (!episode) {
      throw errors.episodeNotFound();
    }
    episodeUrl = episodeUrlOf(episode);
  } else if (episodes.length > 0) {
    const first = episodes[0];
    episodeId = first.id;
    episodeUrl = episodeUrlOf(first);
  }

  await libraryRepo.upsertHistory({
    userId: user.id,
    contentId: detail.id,
    contentUrl: contentUrlOf(detail),
    episodeId,
    episodeUrl,
    positionSeconds: input.position,
    durationSeconds: input.duration ?? null,
  });

  res.status(201).json({ status: "success", data: { saved: true } });
}

export async function removeHistoryEntry(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const removed = await libraryRepo.removeHistory(user.id, req.params.contentId);
  res.status(200).json({ status: "success", data: { contentId: req.params.contentId, removed } });
}

export async function clearHistory(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const removed = await libraryRepo.clearHistory(user.id);
  res.status(200).json({ status: "success", data: { removed } });
}
