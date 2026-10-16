/**
 * Internal normalized contracts.
 * The frontend only ever consumes these shapes - never raw source payloads.
 */

export type ContentSource = "otakudesu" | "oploverz";
export type ContentType = "anime";

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
  anime: AnimeCard | null;
  episode: AnimeEpisode | null;
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
  anime: AnimeCard | null;
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
  anime: AnimeCard | null;
  available: boolean;
}
