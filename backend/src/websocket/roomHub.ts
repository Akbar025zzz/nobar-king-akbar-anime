import type { Server, Socket } from "socket.io";
import { env } from "../config/env";
import type { ChatMessageDTO, RoomParticipantInfo, UserDTO } from "../domain/contracts";
import { AppError, isAppError } from "../domain/errors";
import { roomBus } from "../realtime/bus";
import {
  addSocket,
  computedPosition,
  dropRuntime,
  ensureRuntime,
  getRuntime,
  listRuntimeRooms,
  removeSocket,
  type RoomRuntime,
} from "../realtime/state";
import * as roomsRepo from "../repositories/rooms.repo";
import { authenticate } from "../services/auth.service";
import { toChatDTO } from "../services/room.service";
import { logger } from "../utils/logger";

const CHAT_MAX_LENGTH = 500;
const CHAT_MIN_GAP_MS = 700;

interface SocketData {
  user: UserDTO;
  roomId: string | null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function emitRoomError(socket: Socket, error: unknown): void {
  const appError = isAppError(error)
    ? error
    : new AppError("INTERNAL_ERROR", "Terjadi kesalahan pada room.");
  socket.emit("room:error", { code: appError.code, message: appError.message });
}

function syncPayload(runtime: RoomRuntime) {
  return {
    isPlaying: runtime.playback.isPlaying,
    position: computedPosition(runtime.playback),
    updatedAt: runtime.playback.updatedAt,
    episodeId: runtime.playback.episodeId ?? runtime.episodeId,
    serverTime: Date.now(),
  };
}

function participantDTOs(runtime: RoomRuntime): RoomParticipantInfo[] {
  return Array.from(runtime.participants.values()).map((participant) => ({
    userId: participant.userId,
    username: participant.username,
    avatarColor: participant.avatarColor,
    isHost: participant.isHost,
    joinedAt: new Date(participant.joinedAt).toISOString(),
  }));
}

function broadcastPresence(io: Server, runtime: RoomRuntime): void {
  const participants = participantDTOs(runtime);
  io.to(runtime.roomId).emit("room:update", {
    participants,
    participantCount: participants.length,
  });
}

async function isRoomParticipant(roomId: string, userId: string): Promise<boolean> {
  const rows = await roomsRepo.listParticipants(roomId);
  return rows.some((row) => row.user_id === userId);
}

const chatActivity = new Map<string, number[]>();

function chatAllowed(userId: string): boolean {
  const now = Date.now();
  const history = (chatActivity.get(userId) ?? []).filter((ts) => now - ts < 60_000);
  if (history.length >= env.rateLimits.chatPerMinute) {
    chatActivity.set(userId, history);
    return false;
  }
  const last = history[history.length - 1] ?? 0;
  if (now - last < CHAT_MIN_GAP_MS) {
    chatActivity.set(userId, history);
    return false;
  }
  history.push(now);
  chatActivity.set(userId, history);
  return true;
}

async function joinRoom(io: Server, socket: Socket, roomId: string): Promise<void> {
  const data = socket.data as SocketData;
  const user = data.user;

  if (data.roomId && data.roomId !== roomId) {
    await leaveRoom(io, socket);
  }

  const row = await roomsRepo.getRoomById(roomId);
  if (!row) {
    socket.emit("room:error", { code: "ROOM_NOT_FOUND", message: "Room tidak ditemukan." });
    return;
  }
  if (!row.is_active) {
    socket.emit("room:error", { code: "ROOM_ENDED", message: "Room sudah berakhir." });
    return;
  }
  if (row.privacy === "private") {
    const allowed = user.id === row.host_id || (await isRoomParticipant(roomId, user.id));
    if (!allowed) {
      socket.emit("room:error", { code: "ROOM_PRIVATE", message: "Room ini private." });
      return;
    }
  }

  const stored = row.playback_state as
    | { isPlaying?: boolean; position?: number; updatedAt?: number; episodeId?: string | null }
    | null;

  // Cap stale extrapolation: a persisted "playing" state older than 30
  // minutes (e.g. after a crash) resumes at most 30 minutes ahead.
  const STALE_CAP_MS = 30 * 60 * 1000;

  const runtime = ensureRuntime({
    roomId,
    hostId: row.host_id,
    episodeId: row.episode_id,
    episodeUrl: row.episode_url,
    playback: stored
      ? {
          isPlaying: Boolean(stored.isPlaying),
          position: typeof stored.position === "number" ? stored.position : 0,
          updatedAt: Math.max(
            typeof stored.updatedAt === "number" ? stored.updatedAt : Date.now(),
            Date.now() - STALE_CAP_MS
          ),
          episodeId: stored.episodeId ?? row.episode_id ?? null,
        }
      : null,
  });

  if (
    runtime.participants.size >= env.rooms.maxParticipants &&
    !runtime.participants.has(user.id)
  ) {
    socket.emit("room:error", { code: "ROOM_FULL", message: "Room sudah penuh." });
    return;
  }

  await roomsRepo.addOrTouchParticipant(roomId, user.id).catch(() => undefined);
  addSocket(
    runtime,
    {
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      isHost: user.id === runtime.hostId,
      joinedAt: Date.now(),
    },
    socket.id
  );
  runtime.lastActivity = Date.now();

  data.roomId = roomId;
  await socket.join(roomId);

  socket.emit("room:joined", { roomId });
  socket.emit("player:sync", syncPayload(runtime));

  const messages = await roomsRepo.listMessages(roomId, 60).catch(() => []);
  socket.emit("chat:history", messages.map(toChatDTO));

  broadcastPresence(io, runtime);
  logger.info("socket joined room", { roomId, userId: user.id });
}

async function leaveRoom(io: Server, socket: Socket): Promise<void> {
  const data = socket.data as SocketData;
  const roomId = data.roomId;
  if (!roomId) return;
  data.roomId = null;

  const runtime = getRuntime(roomId);
  const user = data.user;

  if (runtime) {
    const fullyLeft = removeSocket(runtime, user.id, socket.id);
    runtime.lastActivity = Date.now();

    if (fullyLeft) {
      await roomsRepo.touchParticipant(roomId, user.id).catch(() => undefined);

      // An empty room must never keep "playing" unattended: freeze the
      // playback state so the position cannot extrapolate forever.
      if (runtime.participants.size === 0 && runtime.playback.isPlaying) {
        const frozen = computedPosition(runtime.playback);
        runtime.playback = {
          isPlaying: false,
          position: frozen,
          updatedAt: Date.now(),
          episodeId: runtime.playback.episodeId,
        };
        void roomsRepo
          .updatePlaybackState(roomId, {
            isPlaying: false,
            position: frozen,
            updatedAt: Date.now(),
            episodeId: runtime.playback.episodeId ?? runtime.episodeId,
          })
          .catch(() => undefined);
        logger.info("room playback frozen (empty)", { roomId, position: Math.round(frozen) });
      }

      if (user.id === runtime.hostId && runtime.participants.size > 0) {
        const nextHost = Array.from(runtime.participants.values()).sort(
          (a, b) => a.joinedAt - b.joinedAt
        )[0];
        if (nextHost) {
          runtime.hostId = nextHost.userId;
          nextHost.isHost = true;
          await roomsRepo.updateRoomHost(roomId, nextHost.userId).catch(() => undefined);
          io.to(roomId).emit("host:change", { hostId: nextHost.userId, username: nextHost.username });
          logger.info("host transferred", { roomId, newHost: nextHost.userId });
        }
      }
    }
    broadcastPresence(io, runtime);
  }

  await socket.leave(roomId);
  logger.info("socket left room", { roomId, userId: user.id });
}

function registerPlayerHandlers(io: Server, socket: Socket): void {
  const data = socket.data as SocketData;

  const getRuntimeOrFail = (): RoomRuntime | null => {
    if (!data.roomId) {
      emitRoomError(socket, new AppError("NOT_ROOM_MEMBER", "Kamu belum bergabung ke room."));
      return null;
    }
    const runtime = getRuntime(data.roomId);
    if (!runtime) {
      emitRoomError(socket, new AppError("ROOM_NOT_FOUND", "Room tidak aktif."));
      return null;
    }
    return runtime;
  };

  const requireHost = (runtime: RoomRuntime): boolean => {
    if (runtime.hostId !== data.user.id) {
      emitRoomError(socket, new AppError("NOT_ROOM_HOST", "Hanya host yang dapat mengontrol pemutaran."));
      return false;
    }
    return true;
  };

  socket.on("room:join", (payload: { roomId?: string }) => {
    const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
    if (!roomId) {
      emitRoomError(socket, new AppError("INVALID_REQUEST", "roomId wajib diisi."));
      return;
    }
    joinRoom(io, socket, roomId).catch((error) => emitRoomError(socket, error));
  });

  socket.on("room:leave", () => {
    leaveRoom(io, socket).catch((error) => emitRoomError(socket, error));
  });

  socket.on("player:play", (payload: { position?: number }) => {
    const runtime = getRuntimeOrFail();
    if (!runtime || !requireHost(runtime)) return;
    const position = typeof payload?.position === "number" && payload.position >= 0 ? payload.position : computedPosition(runtime.playback);
    runtime.playback = { isPlaying: true, position, updatedAt: Date.now(), episodeId: runtime.playback.episodeId };
    runtime.lastActivity = Date.now();
    socket.to(runtime.roomId).emit("player:sync", syncPayload(runtime));
  });

  socket.on("player:pause", (payload: { position?: number }) => {
    const runtime = getRuntimeOrFail();
    if (!runtime || !requireHost(runtime)) return;
    const position = typeof payload?.position === "number" && payload.position >= 0 ? payload.position : computedPosition(runtime.playback);
    runtime.playback = { isPlaying: false, position, updatedAt: Date.now(), episodeId: runtime.playback.episodeId };
    runtime.lastActivity = Date.now();
    socket.to(runtime.roomId).emit("player:sync", syncPayload(runtime));
  });

  socket.on("player:seek", (payload: { position?: number }) => {
    const runtime = getRuntimeOrFail();
    if (!runtime || !requireHost(runtime)) return;
    const position = typeof payload?.position === "number" && payload.position >= 0 ? payload.position : 0;
    runtime.playback = {
      isPlaying: runtime.playback.isPlaying,
      position,
      updatedAt: Date.now(),
      episodeId: runtime.playback.episodeId,
    };
    runtime.lastActivity = Date.now();
    socket.to(runtime.roomId).emit("player:sync", syncPayload(runtime));
  });

  socket.on("player:episodeChange", (payload: { episodeId?: string }) => {
    const runtime = getRuntimeOrFail();
    if (!runtime || !requireHost(runtime)) return;
    const episodeId = typeof payload?.episodeId === "string" ? payload.episodeId : "";
    if (!episodeId) {
      emitRoomError(socket, new AppError("INVALID_REQUEST", "episodeId wajib diisi."));
      return;
    }
    // The REST service performs validation + persistence; it emits roomBus events
    // that update the runtime and notify every participant.
    roomBus.emit("room:episode:request", { roomId: runtime.roomId, episodeId, userId: data.user.id });
  });

  socket.on("chat:message", (payload: { message?: string }) => {
    const runtime = getRuntimeOrFail();
    if (!runtime) return;
    const raw = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!raw || raw.length > CHAT_MAX_LENGTH) {
      emitRoomError(socket, new AppError("VALIDATION_ERROR", "Pesan tidak valid."));
      return;
    }
    if (!chatAllowed(data.user.id)) {
      emitRoomError(socket, new AppError("RATE_LIMITED", "Terlalu banyak pesan. Tunggu sebentar."));
      return;
    }

    const user = data.user;
    roomsRepo
      .addMessage(runtime.roomId, user.id, raw)
      .then((row) => {
        const dto: ChatMessageDTO = {
          id: row.id,
          roomId: row.room_id,
          userId: row.user_id,
          username: user.username,
          avatarColor: user.avatarColor,
          message: row.message,
          createdAt: row.created_at.toISOString(),
        };
        runtime.lastActivity = Date.now();
        io.to(runtime.roomId).emit("chat:message", dto);
      })
      .catch((error) => emitRoomError(socket, error));
  });

  socket.on("room:end", () => {
    const runtime = getRuntimeOrFail();
    if (!runtime || !requireHost(runtime)) return;
    roomsRepo
      .endRoom(runtime.roomId)
      .then(() => {
        io.to(runtime.roomId).emit("room:end", { reason: "host_ended" });
        dropRuntime(runtime.roomId);
        logger.info("room ended via socket", { roomId: runtime.roomId });
      })
      .catch((error) => emitRoomError(socket, error));
  });

  socket.on("disconnect", () => {
    leaveRoom(io, socket).catch(() => undefined);
  });
}

export function attachRoomHub(io: Server): void {
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[env.session.cookieName] ?? null;
      const user = await authenticate(token);
      if (!user) {
        next(new Error("unauthorized"));
        return;
      }
      const data = socket.data as SocketData;
      data.user = user;
      data.roomId = null;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    registerPlayerHandlers(io, socket);
  });

  // REST -> realtime notifications
  roomBus.on("room:end", (payload: { roomId: string }) => {
    io.to(payload.roomId).emit("room:end", { reason: "ended" });
    dropRuntime(payload.roomId);
  });

  roomBus.on("room:episode", (payload: { roomId: string; episode?: { id: string; url: string | null } }) => {
    const runtime = getRuntime(payload.roomId);
    if (!runtime || !payload.episode) return;
    runtime.episodeId = payload.episode.id;
    runtime.episodeUrl = payload.episode.url;
    runtime.playback = {
      isPlaying: false,
      position: 0,
      updatedAt: Date.now(),
      episodeId: payload.episode.id,
    };
    runtime.lastActivity = Date.now();
    io.to(payload.roomId).emit("room:episode", { episode: payload.episode });
    io.to(payload.roomId).emit("player:sync", syncPayload(runtime));
  });

  // periodic playback synchronisation (spec: periodic sync from server)
  const syncTimer = setInterval(() => {
    for (const runtime of listRuntimeRooms()) {
      if (runtime.participants.size === 0) continue;
      if (!runtime.playback.isPlaying) continue;
      io.to(runtime.roomId).emit("player:sync", syncPayload(runtime));
    }
  }, 6_000);
  syncTimer.unref();

  // periodic playback persistence (survives restarts)
  const persistTimer = setInterval(() => {
    for (const runtime of listRuntimeRooms()) {
      if (runtime.participants.size === 0) continue;
      void roomsRepo
        .updatePlaybackState(runtime.roomId, {
          isPlaying: runtime.playback.isPlaying,
          position: computedPosition(runtime.playback),
          updatedAt: Date.now(),
          episodeId: runtime.playback.episodeId ?? runtime.episodeId,
        })
        .catch(() => undefined);
    }
  }, 15_000);
  persistTimer.unref();

  // drop idle empty runtimes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const runtime of listRuntimeRooms()) {
      if (runtime.participants.size === 0 && now - runtime.lastActivity > 6 * 60 * 60 * 1000) {
        dropRuntime(runtime.roomId);
      }
    }
  }, 10 * 60 * 1000);
  cleanupTimer.unref();

  logger.info("room hub attached");
}
