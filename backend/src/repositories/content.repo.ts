import type { AnimeCard } from "../domain/contracts";
import { sourceFromContentId } from "../adapters/wajik/wajik.adapter";
import { query } from "../database/pool";

export interface ContentRow {
  source: string;
  content_id: string;
  content_url: string | null;
  source_ref: string | null;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  status: string | null;
  year: string | null;
  score: number | null;
  kind: string | null;
  genres: string[];
  last_seen_at: Date;
}

export function rowToCard(row: ContentRow): AnimeCard {
  const type: AnimeCard["type"] = row.content_id.startsWith("tmdb:movie:")
    ? "movie"
    : row.content_id.startsWith("tmdb:series:")
      ? "series"
      : "anime";
  return {
    id: row.content_id,
    source: sourceFromContentId(row.content_id),
    type,
    title: row.title,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    status: (row.status as AnimeCard["status"]) ?? null,
    year: row.year,
    score: row.score === null ? null : Number(row.score),
    kind: row.kind,
    genres: Array.isArray(row.genres) ? row.genres : [],
    sourceUrl: row.content_url,
  };
}

/**
 * Persist/refresh discovered content references so that rooms, favorites and
 * history can resolve a slug back to a valid source URL without guessing.
 */
/** Minimal shape that can be persisted into content_index (anime maupun film). */
export interface ContentIndexCard {
  source: string;
  id: string;
  sourceUrl: string | null;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  status: string | null;
  year: string | null;
  score: number | null;
  genres: string[];
}

export async function upsertContentCards(cards: ContentIndexCard[]): Promise<void> {
  if (cards.length === 0) return;

  const values: unknown[] = [];
  const tuples: string[] = [];
  cards.forEach((card, index) => {
    const base = index * 10;
    tuples.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`
    );
    values.push(
      card.source,
      card.id,
      card.sourceUrl,
      card.title,
      card.posterUrl,
      card.backdropUrl,
      card.status,
      card.year,
      card.score,
      JSON.stringify(card.genres ?? [])
    );
  });

  await query(
    `INSERT INTO content_index
       (source, content_id, content_url, title, poster_url, backdrop_url, status, year, score, genres)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (source, content_id) DO UPDATE SET
       content_url = COALESCE(EXCLUDED.content_url, content_index.content_url),
       title = EXCLUDED.title,
       poster_url = COALESCE(EXCLUDED.poster_url, content_index.poster_url),
       backdrop_url = COALESCE(EXCLUDED.backdrop_url, content_index.backdrop_url),
       status = COALESCE(EXCLUDED.status, content_index.status),
       year = COALESCE(EXCLUDED.year, content_index.year),
       score = COALESCE(EXCLUDED.score, content_index.score),
       genres = CASE WHEN EXCLUDED.genres = '[]'::jsonb THEN content_index.genres ELSE EXCLUDED.genres END,
       last_seen_at = now()`,
    values
  );
}

export async function getContentRow(source: string, contentId: string): Promise<ContentRow | null> {
  const rows = await query<ContentRow>(
    `SELECT * FROM content_index WHERE content_id = $1 AND ($2::text IS NULL OR source = $2)`,
    [contentId, source || null]
  );
  return rows[0] ?? null;
}

export async function getContentRows(ids: string[]): Promise<Map<string, ContentRow>> {
  const map = new Map<string, ContentRow>();
  if (ids.length === 0) return map;
  const rows = await query<ContentRow>(
    `SELECT * FROM content_index WHERE content_id = ANY($1::text[])`,
    [ids]
  );
  for (const row of rows) {
    map.set(row.content_id, row);
  }
  return map;
}
