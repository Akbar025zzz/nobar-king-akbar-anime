export type ContentSource = "otakudesu" | "oploverz";
export type ContentType = "anime";
export type AnimeStatus = "ongoing" | "finished" | null;

export interface AnimeCard {
  id: string;
  source: ContentSource;
  type: ContentType;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  status: AnimeStatus;
  year: string | null;
  score: number | null;
  kind: string | null;
  genres: string[];
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
  /** Same-origin signed proxy URL, produced by the backend. */
  proxyUrl?: string | null;
  label: string | null;
  server: string | null;
}

export interface EpisodeStreamResolution {
  contentId: string;
  episodeId: string;
  sources: StreamSource[];
  picked: StreamSource | null;
}

export interface TrendingEntry {
  rank: number;
  anime: AnimeCard;
  watchers: number;
  rooms: number;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
  createdAt: string;
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

export interface PaginatedMeta {
  page: number;
  hasNextPage: boolean;
}

export interface GenreOption {
  name: string;
  slug: string;
}

/** Socket.IO payloads */
export interface PlayerSyncPayload {
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  episodeId: string | null;
  serverTime: number;
}

export interface PresencePayload {
  participants: RoomParticipantInfo[];
  participantCount: number;
}

export interface RoomErrorPayload {
  code: string;
  message: string;
}
