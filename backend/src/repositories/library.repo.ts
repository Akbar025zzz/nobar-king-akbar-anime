import { query, queryOne } from "../database/pool";
import { sourceFromContentId } from "../adapters/wajik/wajik.adapter";

export interface FavoriteRow {
  user_id: string;
  source: string;
  content_type: string;
  content_id: string;
  content_url: string | null;
  created_at: Date;
}

export interface HistoryRow {
  user_id: string;
  source: string;
  content_type: string;
  content_id: string;
  content_url: string | null;
  episode_id: string | null;
  episode_url: string | null;
  position_seconds: string | number;
  duration_seconds: string | number | null;
  updated_at: Date;
}

export async function addFavorite(input: {
  userId: string;
  contentId: string;
  contentUrl: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO favorites (user_id, source, content_type, content_id, content_url)
     VALUES ($1, $4, 'anime', $2, $3)
     ON CONFLICT (user_id, source, content_id)
     DO UPDATE SET content_url = COALESCE(EXCLUDED.content_url, favorites.content_url)`,
    [input.userId, input.contentId, input.contentUrl, sourceFromContentId(input.contentId)]
  );
}

export async function removeFavorite(userId: string, contentId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM favorites WHERE user_id = $1 AND source = $3 AND content_id = $2 RETURNING id`,
    [userId, contentId, sourceFromContentId(contentId)]
  );
  return rows.length > 0;
}

export async function listFavorites(userId: string): Promise<FavoriteRow[]> {
  return query<FavoriteRow>(
    `SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );
}

export async function isFavorite(userId: string, contentId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM favorites WHERE user_id = $1 AND source = $3 AND content_id = $2`,
    [userId, contentId, sourceFromContentId(contentId)]
  );
  return row !== null;
}

export async function upsertHistory(input: {
  userId: string;
  contentId: string;
  contentUrl: string | null;
  episodeId: string | null;
  episodeUrl: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO watch_history
       (user_id, source, content_type, content_id, content_url, episode_id, episode_url, position_seconds, duration_seconds, updated_at)
     VALUES ($1, $8, 'anime', $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (user_id, source, content_id) DO UPDATE SET
       content_url = COALESCE(EXCLUDED.content_url, watch_history.content_url),
       episode_id = EXCLUDED.episode_id,
       episode_url = COALESCE(EXCLUDED.episode_url, watch_history.episode_url),
       position_seconds = EXCLUDED.position_seconds,
       duration_seconds = COALESCE(EXCLUDED.duration_seconds, watch_history.duration_seconds),
       updated_at = now()`,
    [
      input.userId,
      input.contentId,
      input.contentUrl,
      input.episodeId,
      input.episodeUrl,
      input.positionSeconds,
      input.durationSeconds,
      sourceFromContentId(input.contentId),
    ]
  );
}

export async function listHistory(userId: string, limit = 40): Promise<HistoryRow[]> {
  return query<HistoryRow>(
    `SELECT * FROM watch_history WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [userId, limit]
  );
}

export async function removeHistory(userId: string, contentId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM watch_history WHERE user_id = $1 AND source = $3 AND content_id = $2 RETURNING id`,
    [userId, contentId, sourceFromContentId(contentId)]
  );
  return rows.length > 0;
}

export async function clearHistory(userId: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM watch_history WHERE user_id = $1 RETURNING id`,
    [userId]
  );
  return rows.length;
}

export interface TrendingStatRow {
  content_id: string;
  watchers: string;
  rooms: string;
}

/**
 * Real internal activity metrics. No fabricated numbers: when the site has no
 * activity yet, this returns an empty list and the UI shows an empty state.
 */
export async function trendingStats(days: number, limit = 10): Promise<TrendingStatRow[]> {
  return query<TrendingStatRow>(
    `WITH watch AS (
       SELECT content_id, count(DISTINCT user_id)::text AS watchers
       FROM watch_history
       WHERE updated_at > now() - ($1 || ' days')::interval
       GROUP BY content_id
     ), room AS (
       SELECT content_id, count(*)::text AS rooms
       FROM rooms
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY content_id
     )
     SELECT COALESCE(w.content_id, r.content_id) AS content_id,
            COALESCE(w.watchers, '0') AS watchers,
            COALESCE(r.rooms, '0') AS rooms
     FROM watch w FULL OUTER JOIN room r ON r.content_id = w.content_id
     ORDER BY (COALESCE(w.watchers, '0')::int * 2 + COALESCE(r.rooms, '0')::int * 3) DESC
     LIMIT $2`,
    [String(days), limit]
  );
}
