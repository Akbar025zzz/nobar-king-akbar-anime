/**
 * In-memory runtime state for Nobar rooms.
 * The database is the durable source of truth; this store holds live
 * presence + playback state while a room has connected sockets.
 */

export interface RuntimeParticipant {
  userId: string;
  username: string;
  avatarColor: string;
  isHost: boolean;
  joinedAt: number;
  sockets: Set<string>;
}

export interface RuntimePlayback {
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  episodeId: string | null;
}

export interface RoomRuntime {
  roomId: string;
  hostId: string;
  episodeId: string | null;
  episodeUrl: string | null;
  playback: RuntimePlayback;
  participants: Map<string, RuntimeParticipant>;
  lastActivity: number;
}

const rooms = new Map<string, RoomRuntime>();

export function getRuntime(roomId: string): RoomRuntime | undefined {
  return rooms.get(roomId);
}

export function ensureRuntime(input: {
  roomId: string;
  hostId: string;
  episodeId: string | null;
  episodeUrl: string | null;
  playback?: RuntimePlayback | null;
}): RoomRuntime {
  const existing = rooms.get(input.roomId);
  if (existing) {
    return existing;
  }
  const runtime: RoomRuntime = {
    roomId: input.roomId,
    hostId: input.hostId,
    episodeId: input.episodeId,
    episodeUrl: input.episodeUrl,
    playback: input.playback ?? {
      isPlaying: false,
      position: 0,
      updatedAt: Date.now(),
      episodeId: input.episodeId,
    },
    participants: new Map(),
    lastActivity: Date.now(),
  };
  rooms.set(input.roomId, runtime);
  return runtime;
}

export function dropRuntime(roomId: string): void {
  rooms.delete(roomId);
}

export function getRuntimePlayback(roomId: string): RuntimePlayback | null {
  const runtime = rooms.get(roomId);
  return runtime ? { ...runtime.playback } : null;
}

export function addSocket(runtime: RoomRuntime, participant: Omit<RuntimeParticipant, "sockets">, socketId: string): void {
  const existing = runtime.participants.get(participant.userId);
  if (existing) {
    existing.sockets.add(socketId);
    existing.username = participant.username;
    existing.avatarColor = participant.avatarColor;
    existing.isHost = participant.isHost;
    return;
  }
  runtime.participants.set(participant.userId, {
    ...participant,
    sockets: new Set([socketId]),
  });
}

export function removeSocket(runtime: RoomRuntime, userId: string, socketId: string): boolean {
  const participant = runtime.participants.get(userId);
  if (!participant) {
    return true;
  }
  participant.sockets.delete(socketId);
  if (participant.sockets.size === 0) {
    runtime.participants.delete(userId);
    return true;
  }
  return false;
}

export function activeParticipantCount(runtime: RoomRuntime | undefined): number {
  if (!runtime) return 0;
  return runtime.participants.size;
}

export function listRuntimeRooms(): RoomRuntime[] {
  return Array.from(rooms.values());
}

export function computedPosition(playback: RuntimePlayback, now = Date.now()): number {
  if (!playback.isPlaying) {
    return playback.position;
  }
  const elapsed = Math.max(0, now - playback.updatedAt) / 1000;
  return playback.position + elapsed;
}
