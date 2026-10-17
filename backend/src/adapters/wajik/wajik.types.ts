/**
 * Raw response shapes of the self-hosted wajik-anime-api
 * (https://github.com/wajik45/wajik-anime-api, MIT).
 *
 * Sources verified live: otakudesu (primary, Cloudflare-protected -> the
 * vendored API fetches it through a real browser) and oploverz.
 */

export interface WajikEnvelope<T> {
  statusCode: number;
  statusMessage: string;
  message: string;
  ok?: boolean;
  data: T | null;
  pagination?: WajikPagination | null;
}

export interface WajikPagination {
  currentPage: number | null;
  hasPrevPage: boolean;
  prevPage: number | null;
  hasNextPage: boolean;
  nextPage: number | null;
  totalPages: number | null;
}

/* --------------------------------- otakudesu -------------------------------- */

export interface OtakudesuOngoingAnime {
  title: string;
  poster: string | null;
  episodes: number | string | null;
  releaseDay?: string | null;
  latestReleaseDate?: string | null;
  animeId: string;
  href?: string | null;
  otakudesuUrl: string;
}

export interface OtakudesuCompletedAnime {
  title: string;
  poster: string | null;
  episodes: number | string | null;
  animeId: string;
  score?: string | null;
  lastReleaseDate?: string | null;
  otakudesuUrl: string;
}

export interface OtakudesuSearchAnime {
  title: string;
  animeId: string;
  poster: string | null;
  score?: string | null;
  status?: string | null;
  genres?: string[] | null;
  otakudesuUrl: string;
}

export interface OtakudesuGenreRef {
  title: string;
  genreId: string;
  otakudesuUrl: string;
}

export interface OtakudesuEpisodeRef {
  title: string;
  episodeId: string;
  otakudesuUrl: string;
}

export interface OtakudesuAnimeDetails {
  title: string;
  japanese?: string | null;
  score?: string | null;
  producers?: string | null;
  type?: string | null;
  status?: string | null;
  episodes?: number | string | null;
  duration?: string | null;
  aired?: string | null;
  studios?: string | null;
  poster: string | null;
  synopsis?: string | null;
  batch?: unknown;
  genreList?: OtakudesuGenreRef[] | null;
  episodeList?: OtakudesuEpisodeRef[] | null;
  recommendedAnimeList?: unknown;
}

export interface OtakudesuServerRef {
  title: string;
  serverId: string;
}

export interface OtakudesuQualityGroup {
  title: string;
  serverList?: OtakudesuServerRef[] | null;
}

export interface OtakudesuEpisodeDetails {
  title: string;
  animeId: string;
  releaseTime?: string | null;
  defaultStreamingUrl?: string | null;
  hasPrevEpisode?: boolean;
  prevEpisode?: unknown;
  hasNextEpisode?: boolean;
  nextEpisode?: unknown;
  server?: { qualityList?: OtakudesuQualityGroup[] | null } | null;
  download?: unknown;
  info?: unknown;
}

export interface OtakudesuServerDetails {
  url: string;
}

/* --------------------------------- oploverz --------------------------------- */

export interface OploverzAnime {
  title: string;
  poster?: string | null;
  type?: string | null;
  status?: string | null;
  slug?: string | null;
  episode?: string | null;
  seriesName?: string | null;
  href?: string | null;
  otakudesuUrl?: string | null;
}

export interface OploverzEpisodeRef {
  episode: string;
  title: string;
  date?: string | null;
  href: string;
}

export interface OploverzAnimeDetails {
  title: string;
  poster?: string | null;
  status?: string | null;
  studio?: string | null;
  duration?: string | null;
  season?: string | null;
  type?: string | null;
  rating?: string | null;
  releasedOn?: string | null;
  updatedOn?: string | null;
  synopsis?: string | null;
  genres?: string[] | null;
  episodeList?: OploverzEpisodeRef[] | null;
}

export interface OploverzEpisodeDetails {
  title: string;
  episodeNumber?: string | null;
  seriesName?: string | null;
  seriesSlug?: string | null;
  seriesHref?: string | null;
  streamingUrl?: string | null;
  releasedOn?: string | null;
  hasPrevEpisode?: boolean;
  prevEpisode?: unknown;
  hasNextEpisode?: boolean;
  nextEpisode?: unknown;
}

/* --------------------- oploverz: home / direktori / jadwal ------------------- */

/** Item dari /oploverz/home (popularToday & latestRelease berisi episode). */
export interface OploverzHomeAnime {
  title: string;
  poster?: string | null;
  type?: string | null;
  episode?: string | null;
  status?: string | null;
  score?: string | null;
  genres?: string[] | null;
  releaseTime?: string | null;
  seriesName?: string | null;
  href?: string | null;
}

export interface OploverzHomePayload {
  popularToday?: { animeList?: OploverzHomeAnime[] | null } | null;
  latestRelease?: { animeList?: OploverzHomeAnime[] | null } | null;
}

/** Entri direktori A-Z (/oploverz/anime) - hanya judul + slug. */
export interface OploverzDirectoryEntry {
  title: string;
  slug?: string | null;
  href?: string | null;
}

export interface OploverzSection {
  letter: string;
  animeList?: OploverzDirectoryEntry[] | null;
}

/** Grup jadwal rilis (/oploverz/schedule) - berisi poster + slug. */
export interface OploverzScheduleDay {
  day: string;
  animeList?: OploverzAnime[] | null;
}
