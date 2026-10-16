import type {
  AnimeCard,
  AnimeEpisode,
  ChatMessageDTO,
  RoomContentRef,
  RoomDTO,
  RoomParticipantInfo,
  RoomPlaybackState,
  UserDTO,
} from "../domain/contracts";
import { errors } from "../domain/errors";
import { getContentRow, rowToCard } from "../repositories/content.repo";
import * as roomsRepo from "../repositories/rooms.repo";
import type { MessageRow, RoomRow } from "../repositories/rooms.repo";
import { findUserById } from "../repositories/users.repo";
import { getRuntime, getRuntimePlayback } from "../realtime/state";
import { episodeNumberFromUrl, getAnimeDetail } from "./content.service";
import { sourceFromContentId } from "../adapters/wajik/wajik.adapter";
import { logger } from "../utils/logger";

export interface CreateRoomInput {
  contentId: string;
  episodeId?: string | null;
  roomName?: string;
  privacy?: "public" | "private";
}

function defaultPlayback(row: RoomRow): RoomPlaybackState {
  const stored = row.playback_state as
    | { isPlaying?: boolean; position?: number; updatedAt?: number; episodeId?: string | null }
    | null
    | undefined;
  return {
    isPlaying: Boolean(stored?.isPlaying),
    position: typeof stored?.position === "number" ? stored.position : 0,
    updatedAt: typeof stored?.updatedAt === "number" ? stored.updatedAt : Date.now(),
    episodeId: stored?.episodeId ?? row.episode_id ?? null,
  };
}

async function buildAnimeCard(row: RoomRow): Promise<AnimeCard | null> {
  const indexRow = await getContentRow(row.source ?? "", row.content_id);
  if (indexRow) {
    return rowToCard(indexRow);
  }
  try {
    const detail = await getAnimeDetail(row.content_id);
    return detail;
  } catch (error) {
    logger.warn("room content lookup failed", {
      roomId: row.id,
      contentId: row.content_id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function buildEpisodeRef(row: RoomRow): Promise<AnimeEpisode | null> {
  if (!row.episode_id && !row.episode_url) {
    return null;
  }
  try {
    const detail = await getAnimeDetail(row.content_id);
    const found = row.episode_id ? detail.episodes.find((item) => item.id === row.episode_id) : null;
    if (found) return found;
  } catch {
    // fall through to the lightweight reference below
  }
  return {
    id: row.episode_id ?? "unknown",
    number: episodeNumberFromUrl(row.episode_url),
    title: null,
    url: row.episode_url,
  };
}

async function buildContentRef(row: RoomRow): Promise<RoomContentRef> {
  const [anime, episode] = await Promise.all([buildAnimeCard(row), buildEpisodeRef(row)]);
  return {
    source: sourceFromContentId(row.content_id),
    contentType: "anime",
    contentId: row.content_id,
    contentUrl: row.content_url,
    episodeId: row.episode_id,
    episodeUrl: row.episode_url,
    anime,
    episode,
  };
}

function participantFromRow(row: roomsRepo.ParticipantRow, hostId: string): RoomParticipantInfo {
  return {
    userId: row.user_id,
    username: row.username,
    avatarColor: row.avatar_color,
    isHost: row.user_id === hostId,
    joinedAt: row.joined_at.toISOString(),
  };
}

export async function toRoomDTO(row: RoomRow): Promise<RoomDTO> {
  const host = await findUserById(row.host_id);
  const runtime = getRuntime(row.id);

  let participants: RoomParticipantInfo[];
  if (runtime && runtime.participants.size > 0) {
    participants = Array.from(runtime.participants.values()).map((participant) => ({
      userId: participant.userId,
      username: participant.username,
      avatarColor: participant.avatarColor,
      isHost: participant.isHost,
      joinedAt: new Date(participant.joinedAt).toISOString(),
    }));
  } else {
    const rows = await roomsRepo.listParticipants(row.id);
    participants = rows.map((participant) => participantFromRow(participant, row.host_id));
  }

  const playback = getRuntimePlayback(row.id) ?? defaultPlayback(row);

  return {
    id: row.id,
    roomName: row.room_name,
    privacy: row.privacy,
    host: {
      id: row.host_id,
      username: host?.username ?? "Host",
      avatarColor: host?.avatar_color ?? "#55CBD8",
    },
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    participants,
    participantCount: participants.length,
    playback,
    content: await buildContentRef(row),
  };
}

export async function createRoom(host: UserDTO, input: CreateRoomInput): Promise<RoomDTO> {
  const detail = await getAnimeDetail(input.contentId);

  let episode: AnimeEpisode | null = null;
  if (detail.episodes.length > 0) {
    if (!input.episodeId) {
      throw errors.validation("Pilih episode terlebih dahulu sebelum membuat room.");
    }
    episode = detail.episodes.find((item) => item.id === input.episodeId) ?? null;
    if (!episode) {
      throw errors.episodeNotFound();
    }
  } else if (input.episodeId) {
    episode = detail.episodes.find((item) => item.id === input.episodeId) ?? null;
  }

  const fallbackName = `${detail.title}${episode?.number ? ` — Episode ${episode.number}` : ""}`;
  const roomName = (input.roomName?.trim() || fallbackName).slice(0, 120);
  const privacy: "public" | "private" = input.privacy === "private" ? "private" : "public";

  const row = await roomsRepo.createRoom({
    hostId: host.id,
    contentId: detail.id,
    contentUrl: detail.sourceUrl,
    episodeId: episode?.id ?? null,
    episodeUrl: episode?.url ?? null,
    roomName,
    privacy,
  });

  logger.info("room created", { roomId: row.id, contentId: detail.id, episodeId: episode?.id ?? null });
  return toRoomDTO(row);
}

async function getRoomRowOrThrow(roomId: string): Promise<RoomRow> {
  const row = await roomsRepo.getRoomById(roomId);
  if (!row) {
    throw errors.roomNotFound();
  }
  return row;
}

async function isParticipant(roomId: string, userId: string): Promise<boolean> {
  const participants = await roomsRepo.listParticipants(roomId);
  return participants.some((participant) => participant.user_id === userId);
}

export async function getRoom(roomId: string, viewer: UserDTO | null): Promise<RoomDTO> {
  const row = await getRoomRowOrThrow(roomId);
  if (row.privacy === "private") {
    const allowed =
      viewer !== null && (viewer.id === row.host_id || (await isParticipant(roomId, viewer.id)));
    if (!allowed) {
      throw errors.roomPrivate();
    }
  }
  return toRoomDTO(row);
}

export async function listLiveRooms(): Promise<RoomDTO[]> {
  const rows = await roomsRepo.listLiveRooms(24);
  const dtos: RoomDTO[] = [];
  for (const row of rows) {
    dtos.push(await toRoomDTO(row));
  }
  return dtos;
}

export async function listRoomsForUser(userId: string): Promise<RoomDTO[]> {
  const rows = await roomsRepo.listRoomsForUser(userId, 30);
  const dtos: RoomDTO[] = [];
  for (const row of rows) {
    dtos.push(await toRoomDTO(row));
  }
  return dtos;
}

export async function endRoom(host: UserDTO, roomId: string): Promise<{ ended: boolean }> {
  const row = await getRoomRowOrThrow(roomId);
  if (row.host_id !== host.id) {
    throw errors.notRoomHost();
  }
  if (!row.is_active) {
    return { ended: false };
  }
  await roomsRepo.endRoom(roomId);
  logger.info("room ended", { roomId, by: host.id });
  return { ended: true };
}

export async function changeEpisode(
  host: UserDTO,
  roomId: string,
  episodeId: string
): Promise<{ room: RoomDTO; episode: AnimeEpisode }> {
  const row = await getRoomRowOrThrow(roomId);
  if (row.host_id !== host.id) {
    throw errors.notRoomHost();
  }
  if (!row.is_active) {
    throw errors.roomEnded();
  }

  const detail = await getAnimeDetail(row.content_id);
  const episode = detail.episodes.find((item) => item.id === episodeId) ?? null;
  if (!episode) {
    throw errors.episodeNotFound();
  }

  await roomsRepo.updateRoomEpisode(roomId, episode.id, episode.url);
  const updated = await getRoomRowOrThrow(roomId);
  return { room: await toRoomDTO(updated), episode };
}

export async function listRoomMessages(roomId: string, viewer: UserDTO | null): Promise<ChatMessageDTO[]> {
  const row = await getRoomRowOrThrow(roomId);
  if (row.privacy === "private" && viewer) {
    const allowed = viewer.id === row.host_id || (await isParticipant(roomId, viewer.id));
    if (!allowed) {
      throw errors.roomPrivate();
    }
  }
  const rows = await roomsRepo.listMessages(roomId, 60);
  return rows.map(toChatDTO);
}

export function toChatDTO(row: MessageRow): ChatMessageDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    username: row.username,
    avatarColor: row.avatar_color,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  };
}
