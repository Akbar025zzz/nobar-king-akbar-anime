/**
 * Internal normalized contracts.
 * The frontend only ever consumes these shapes - never raw source payloads.
 */

export type ContentSource = "otakudesu" | "oploverz" | "tmdb";
export type ContentType = "anime" | "movie" | "series";

/* ---------------------------------- film ----------------------------------- */

export type FilmKind = "movie" | "series";

export interface FilmCard {
  id: string;
  source: "tmdb";
  kind: FilmKind;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: string | null;
  score: number | null;
  genres: string[];
  overview: string | null;
}

export interface FilmCastMember {
  id: number;
  name: string;
  character: string | null;
  photoUrl: string | null;
}

export interface FilmSeason {
  season: number;
  name: string;
  episodeCount: number;
  posterUrl: string | null;
  airDate: string | null;
  overview: string | null;
}

export interface FilmEpisode {
  /** `s<season>e<episode>` - dipakai di URL dan state ruang. */
  id: string;
  season: number;
  number: number;
  title: string | null;
  overview: string | null;
  stillUrl: string | null;
  airDate: string | null;
  runtimeMinutes: number | null;
}

export interface FilmDetail extends FilmCard {
  tagline: string | null;
  runtimeMinutes: number | null;
  status: string | null;
  releaseDate: string | null;
  lastAirDate: string | null;
  cast: FilmCastMember[];
  trailerYoutubeKey: string | null;
  seasons: FilmSeason[];
  episodes: FilmEpisode[];
  totalEpisodes: number | null;
  /** Season yang sedang ditampilkan daftar episodenya (khusus series). */
  activeSeason: number | null;
}

export interface FilmRow {
  key: string;
  title: string;
  items: FilmCard[];
}

/** Kartu konten apa pun yang bisa dipakai ruang nobar / koleksi / riwayat. */
export type ContentCard = AnimeCard | FilmCard;
export type ContentEpisode = AnimeEpisode | FilmEpisode;

export interface AnimeCard {
  id: string;
  source: ContentSource;
  type: ContentType;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  status: string | null;
  year: string | null;
  score: number | null;
  /** Source content kind, e.g. "TV Anime" | "Película" | "OVA". */
  kind: string | null;
  genres: string[];
  /** Canonical source URL (kept server-side for room/favorite references). */
  sourceUrl: string | null;
}

export interface AnimeEpisode {
  id: string;
  number: number | null;
  title: string | null;
  url: string | null;
}

export interface AnimeDetail extends AnimeCard {
  description: string | null;
  titleJapanese: string | null;
  totalEpisodes: number | null;
  startDate: string | null;
  endDate: string | null;
  votes: number | null;
  trailerUrl: string | null;
  episodes: AnimeEpisode[];
}

export type StreamType = "hls" | "mp4" | "iframe" | "embed";

export interface StreamSource {
  id: string;
  type: StreamType;
  url: string;
  /** Same-origin signed proxy URL (source CDNs often lack CORS headers). */
  proxyUrl: string | null;
  label: string | null;
  server: string | null;
}

export interface EpisodeStreamResolution {
  contentId: string;
  episodeId: string;
  sources: StreamSource[];
  picked: StreamSource | null;
}

export interface CatalogMeta {
  page: number;
  hasNextPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: CatalogMeta;
}

export interface TrendingEntry {
  rank: number;
  anime: AnimeCard;
  /** Real internal activity metrics (never fabricated). */
  watchers: number;
  rooms: number;
}

export interface RoomParticipantInfo {
  userId: string;
  username: string;
  avatarColor: string;
  isHost: boolean;
  joinedAt: string;
}

export interface RoomPlaybackState {
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  episodeId: string | null;
}

export interface RoomContentRef {
  source: ContentSource;
  contentType: ContentType;
  contentId: string;
  contentUrl: string | null;
  episodeId: string | null;
  episodeUrl: string | null;
  anime: ContentCard | null;
  episode: ContentEpisode | null;
}

export interface RoomDTO {
  id: string;
  roomName: string;
  privacy: "public" | "private";
  host: { id: string; username: string; avatarColor: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  participants: RoomParticipantInfo[];
  participantCount: number;
  playback: RoomPlaybackState;
  content: RoomContentRef;
}

export interface ChatMessageDTO {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarColor: string;
  message: string;
  createdAt: string;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
  createdAt: string;
}

export interface FavoriteRef {
  source: ContentSource;
  contentType: ContentType;
  contentId: string;
  contentUrl: string | null;
  createdAt: string;
  anime: ContentCard | null;
  available: boolean;
}

export interface HistoryEntry {
  source: ContentSource;
  contentType: ContentType;
  contentId: string;
  contentUrl: string | null;
  episodeId: string | null;
  episodeUrl: string | null;
  episodeNumber: number | null;
  positionSeconds: number;
  durationSeconds: number | null;
  progressPercent: number;
  updatedAt: string;
  anime: ContentCard | null;
  available: boolean;
}
