/**
 * Raw TMDb API v3 shapes (the subset we consume).
 * Docs: https://developer.themoviedb.org/reference/intro/getting-started
 *
 * Dipakai server-side saja; API key tidak pernah dikirim ke browser.
 */

export interface TmdbPaged<T> {
  page?: number;
  results?: T[];
  total_pages?: number;
  total_results?: number;
}

export interface TmdbTitleSummary {
  id: number;
  media_type?: string | null;
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  genre_ids?: number[] | null;
  original_language?: string | null;
  popularity?: number | null;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string | null;
  profile_path?: string | null;
  order?: number | null;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  name?: string | null;
  official?: boolean | null;
  iso_639_1?: string | null;
}

export interface TmdbSeasonRef {
  id: number;
  season_number: number;
  name?: string | null;
  episode_count?: number | null;
  poster_path?: string | null;
  air_date?: string | null;
  overview?: string | null;
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name?: string | null;
  overview?: string | null;
  still_path?: string | null;
  air_date?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
}

export interface TmdbTitleDetails extends TmdbTitleSummary {
  tagline?: string | null;
  status?: string | null;
  runtime?: number | null;
  episode_run_time?: number[] | null;
  genres?: TmdbGenre[] | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  last_air_date?: string | null;
  seasons?: TmdbSeasonRef[] | null;
  credits?: { cast?: TmdbCastMember[] | null } | null;
  videos?: { results?: TmdbVideo[] | null } | null;
}

export interface TmdbSeasonDetails {
  id?: number;
  season_number: number;
  name?: string | null;
  episodes?: TmdbEpisode[] | null;
}
