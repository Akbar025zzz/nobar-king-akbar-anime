"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, errorMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type {
  ChatMessageDTO,
  PlayerSyncPayload,
  PresencePayload,
  RoomDTO,
  RoomErrorPayload,
  RoomParticipantInfo,
} from "@/lib/types";

export function useRoom(roomId: string, userId: string | null) {
  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [participants, setParticipants] = useState<RoomParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [sync, setSync] = useState<PlayerSyncPayload | null>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* ---------------------------- initial load ---------------------------- */
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<RoomDTO>(`/api/rooms/${roomId}`)
      .then((data) => {
        if (!active) return;
        setRoom(data);
        setParticipants(data.participants);
        setCurrentEpisodeId(data.content.episodeId);
        setSync({
          isPlaying: data.playback.isPlaying,
          position: data.playback.position,
          updatedAt: data.playback.updatedAt,
          episodeId: data.playback.episodeId,
          serverTime: Date.now(),
        });
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomId]);

  /* ------------------------------ realtime ------------------------------ */
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();

    const join = () => socket.emit("room:join", { roomId });

    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);
    const onJoined = () => setNotice(null);
    const onPresence = (payload: PresencePayload) => {
      if (Array.isArray(payload?.participants)) {
        setParticipants(payload.participants);
      }
    };
    const onSync = (payload: PlayerSyncPayload) => {
      setSync(payload);
      if (payload.episodeId) setCurrentEpisodeId(payload.episodeId);
    };
    const onChat = (message: ChatMessageDTO) => {
      setMessages((current) => [...current, message].slice(-200));
    };
    const onHistory = (history: ChatMessageDTO[]) => {
      if (Array.isArray(history)) setMessages(history);
    };
    const onRoomEnded = () => setEnded(true);
    const onEpisodeChange = (payload: { episode?: { id: string } }) => {
      if (payload?.episode?.id) setCurrentEpisodeId(payload.episode.id);
    };
    const onRoomError = (payload: RoomErrorPayload) => {
      setNotice(payload.message);
      if (payload.code === "ROOM_ENDED" || payload.code === "ROOM_NOT_FOUND") setEnded(true);
    };
    const onHostChange = (payload: { hostId?: string; username?: string }) => {
      if (!payload?.hostId) return;
      setRoom((current) =>
        current
          ? {
              ...current,
              host: {
                ...current.host,
                id: payload.hostId as string,
                username: payload.username ?? current.host.username,
              },
            }
          : current
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:joined", onJoined);
    socket.on("room:update", onPresence);
    socket.on("player:sync", onSync);
    socket.on("chat:message", onChat);
    socket.on("chat:history", onHistory);
    socket.on("room:end", onRoomEnded);
    socket.on("room:episode", onEpisodeChange);
    socket.on("room:error", onRoomError);
    socket.on("host:change", onHostChange);

    if (socket.connected) {
      setConnected(true);
      join();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit("room:leave");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:joined", onJoined);
      socket.off("room:update", onPresence);
      socket.off("player:sync", onSync);
      socket.off("chat:message", onChat);
      socket.off("chat:history", onHistory);
      socket.off("room:end", onRoomEnded);
      socket.off("room:episode", onEpisodeChange);
      socket.off("room:error", onRoomError);
      socket.off("host:change", onHostChange);
    };
  }, [roomId, userId]);

  /* ------------------------------ actions ------------------------------ */
  const sendChat = useCallback((text: string) => {
    getSocket().emit("chat:message", { message: text });
  }, []);

  const hostPlay = useCallback((position: number) => {
    getSocket().emit("player:play", { position });
  }, []);

  const hostPause = useCallback((position: number) => {
    getSocket().emit("player:pause", { position });
  }, []);

  const hostSeek = useCallback((position: number) => {
    getSocket().emit("player:seek", { position });
  }, []);

  const hostChangeEpisode = useCallback((episodeId: string) => {
    getSocket().emit("player:episodeChange", { episodeId });
  }, []);

  const endRoom = useCallback(() => {
    getSocket().emit("room:end");
  }, []);

  const isHost = Boolean(userId && room && room.host.id === userId);

  return {
    room,
    setRoom,
    participants,
    messages,
    sync,
    currentEpisodeId,
    ended,
    connected,
    loading,
    error,
    notice,
    setNotice,
    isHost,
    sendChat,
    hostPlay,
    hostPause,
    hostSeek,
    hostChangeEpisode,
    endRoom,
  };
}
