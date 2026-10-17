import type {
  FilmCard,
  FilmCastMember,
  FilmDetail,
  FilmEpisode,
  FilmKind,
  FilmSeason,
} from "../../domain/contracts";
import type {
  TmdbSeasonDetails,
  TmdbTitleDetails,
  TmdbTitleSummary,
  TmdbVideo,
} from "./tmdb.types";

/**
 * Normalization layer: raw TMDb payloads -> internal film contracts.
 *
 * Content ids are `tmdb:movie:<id>` / `tmdb:series:<id>` so a single id routes
 * detail, episode, and stream requests later (episode ids: `s<season>e<episode>`).
 */

const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type TmdbImageSize = "w342" | "w500" | "w780" | "original";

export function imageUrl(path: string | null | undefined, size: TmdbImageSize = "w500"): string | null {
  if (!path) return null;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${IMAGE_BASE}/${size}${clean}`;
}

export function filmContentId(kind: FilmKind, tmdbId: number | string): string {
  return `tmdb:${kind}:${tmdbId}`;
}

export function parseFilmContentId(rawId: string): { kind: FilmKind; tmdbId: string } | null {
  const parts = rawId.split(":");
  if (parts.length !== 3 || parts[0] !== "tmdb") return null;
  const kind = parts[1];
  const tmdbId = parts[2];
  if (!tmdbId || !/^\d+$/.test(tmdbId)) return null;
  if (kind !== "movie" && kind !== "series") return null;
  return { kind, tmdbId };
}

export function filmEpisodeId(season: number, episode: number): string {
  return `s${season}e${episode}`;
}

export function parseFilmEpisodeId(raw: string): { season: number; episode: number } | null {
  const match = raw.trim().match(/^s(\d{1,3})e(\d{1,4})$/i);
  if (!match) return null;
  const season = Number.parseInt(match[1], 10);
  const episode = Number.parseInt(match[2], 10);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return null;
  return { season, episode };
}

function yearFrom(date: string | null | undefined): string | null {
  if (!date) return null;
  const match = date.match(/^(\d{4})/);
  return match ? match[1] : null;
}

function titleOf(raw: TmdbTitleSummary, kind: FilmKind): string {
  const primary = kind === "movie" ? raw.title : raw.name;
  const fallback = kind === "movie" ? raw.original_title : raw.original_name;
  return (primary || fallback || "Tanpa judul").trim();
}

function scoreOf(raw: TmdbTitleSummary): number | null {
  if (typeof raw.vote_average !== "number" || raw.vote_average <= 0) return null;
  return Math.round(raw.vote_average * 10) / 10;
}

export function toFilmCard(
  raw: TmdbTitleSummary,
  kind: FilmKind,
  genresById?: Map<number, string>
): FilmCard {
  const genres =
    genresById && raw.genre_ids
      ? raw.genre_ids
          .map((id) => genresById.get(id))
          .filter((value): value is string => Boolean(value))
      : [];

  return {
    id: filmContentId(kind, raw.id),
    source: "tmdb",
    kind,
    title: titleOf(raw, kind),
    posterUrl: imageUrl(raw.poster_path, "w500"),
    backdropUrl: imageUrl(raw.backdrop_path, "w780"),
    year: yearFrom(kind === "movie" ? raw.release_date : raw.first_air_date),
    score: scoreOf(raw),
    genres,
    overview: raw.overview?.trim() || null,
  };
}

/** Prefers an official trailer, then any trailer, then teaser / anything on YouTube. */
export function pickTrailerKey(videos: TmdbVideo[] | null | undefined): string | null {
  if (!videos?.length) return null;
  const youtube = videos.filter((video) => video.site === "YouTube" && video.key);
  if (youtube.length === 0) return null;
  const official = youtube.find((video) => video.type === "Trailer" && video.official);
  const trailer = youtube.find((video) => video.type === "Trailer");
  const teaser = youtube.find((video) => video.type === "Teaser");
  return (official ?? trailer ?? teaser ?? youtube[0]).key;
}

export function toFilmCast(details: TmdbTitleDetails, limit = 18): FilmCastMember[] {
  return (details.credits?.cast ?? [])
    .filter((member) => member?.name)
    .slice(0, limit)
    .map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character?.trim() || null,
      photoUrl: imageUrl(member.profile_path, "w342"),
    }));
}

export function toFilmSeasons(details: TmdbTitleDetails): FilmSeason[] {
  return (details.seasons ?? [])
    .filter((season) => season.season_number > 0 && (season.episode_count ?? 0) > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((season) => ({
      season: season.season_number,
      name: season.name?.trim() || `Season ${season.season_number}`,
      episodeCount: season.episode_count ?? 0,
      posterUrl: imageUrl(season.poster_path, "w342"),
      airDate: season.air_date ?? null,
      overview: season.overview?.trim() || null,
    }));
}

export function toFilmEpisodes(season: TmdbSeasonDetails): FilmEpisode[] {
  return (season.episodes ?? [])
    .filter((episode) => Number.isFinite(episode.episode_number))
    .sort((a, b) => a.episode_number - b.episode_number)
    .map((episode) => ({
      id: filmEpisodeId(episode.season_number, episode.episode_number),
      season: episode.season_number,
      number: episode.episode_number,
      title: episode.name?.trim() || null,
      overview: episode.overview?.trim() || null,
      stillUrl: imageUrl(episode.still_path, "w780"),
      airDate: episode.air_date ?? null,
      runtimeMinutes: typeof episode.runtime === "number" ? episode.runtime : null,
    }));
}

export function toFilmDetail(raw: TmdbTitleDetails, kind: FilmKind): FilmDetail {
  const card = toFilmCard(raw, kind);
  const genres = (raw.genres ?? []).map((genre) => genre.name).filter(Boolean);
  const runtime =
    kind === "movie"
      ? (typeof raw.runtime === "number" ? raw.runtime : null)
      : (raw.episode_run_time?.[0] ?? null);

  return {
    ...card,
    genres: genres.length > 0 ? genres : card.genres,
    tagline: raw.tagline?.trim() || null,
    runtimeMinutes: runtime,
    status: raw.status?.trim() || null,
    releaseDate: (kind === "movie" ? raw.release_date : raw.first_air_date) || null,
    lastAirDate: raw.last_air_date ?? null,
    cast: toFilmCast(raw),
    trailerYoutubeKey: pickTrailerKey(raw.videos?.results),
    seasons: kind === "series" ? toFilmSeasons(raw) : [],
    episodes: [],
    totalEpisodes: kind === "series" ? (raw.number_of_episodes ?? null) : null,
    activeSeason: null,
  };
}
