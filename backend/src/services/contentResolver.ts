import type {
  AnimeDetail,
  ContentEpisode,
  ContentType,
  FilmDetail,
} from "../domain/contracts";
import { getAnimeDetail } from "./content.service";
import { getFilmDetail } from "./film.service";

/**
 * Satu pintu untuk semua jenis konten.
 *
 * Id konten memakai namespace: `otakudesu:<id>`, `oploverz:<slug>`, dan
 * `tmdb:movie:<id>` / `tmdb:series:<id>`. Semua layanan (ruang nobar, koleksi,
 * riwayat) memakai helper di sini supaya tidak ada percabangan yang tersebar.
 */

export function isFilmContentId(contentId: string): boolean {
  return contentId.startsWith("tmdb:");
}

export async function resolveContentDetail(contentId: string): Promise<AnimeDetail | FilmDetail> {
  if (isFilmContentId(contentId)) {
    return getFilmDetail(contentId);
  }
  return getAnimeDetail(contentId);
}

export function contentTypeFrom(contentId: string): ContentType {
  if (contentId.startsWith("tmdb:movie:")) return "movie";
  if (contentId.startsWith("tmdb:series:")) return "series";
  return "anime";
}

export function episodesOf(detail: AnimeDetail | FilmDetail): ContentEpisode[] {
  return Array.isArray(detail.episodes) ? (detail.episodes as ContentEpisode[]) : [];
}

/** URL sumber episode bila ada (film dari provider tidak punya URL sumber). */
export function episodeUrlOf(episode: ContentEpisode | null): string | null {
  if (!episode) return null;
  return "url" in episode && typeof episode.url === "string" ? episode.url : null;
}

/** URL konten sumber (anime punya `sourceUrl`; film tidak). */
export function contentUrlOf(detail: AnimeDetail | FilmDetail): string | null {
  return "sourceUrl" in detail ? detail.sourceUrl : null;
}
