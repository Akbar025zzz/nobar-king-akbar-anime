"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/player/VideoPlayer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { RoomChat } from "@/components/room/RoomChat";
import { RoomParticipants } from "@/components/room/RoomParticipants";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useRoom } from "@/hooks/useRoom";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { episodeLabel } from "@/lib/format";
import { playableSource } from "@/lib/stream";
import type { AnimeDetail, FilmDetail, EpisodeStreamResolution } from "@/lib/types";

type RoomDetail = AnimeDetail | FilmDetail;

interface RoomEpisodeOption {
  id: string;
  number: number | null;
  title: string | null;
}

function isFilmContentId(contentId: string | null | undefined): boolean {
  return Boolean(contentId && contentId.startsWith("tmdb:"));
}

function roomEpisodesOf(detail: RoomDetail | null): RoomEpisodeOption[] {
  if (!detail) return [];
  if (isFilmContentId(detail.id)) {
    const film = detail as FilmDetail;
    if (film.kind === "movie") return [{ id: "movie", number: null, title: film.title }];
    return film.episodes.map((episode) => ({
      id: episode.id,
      number: episode.number,
      title: episode.title,
    }));
  }
  return (detail as AnimeDetail).episodes;
}

export function RoomClient({ roomId }: { roomId: string }) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const {
    room,
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
  } = useRoom(roomId, user?.id ?? null);

  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [resolution, setResolution] = useState<EpisodeStreamResolution | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  /* mode sinema (film): hitung mundur "mulai bareng" + kunci muat ulang player */
  const [cinemaKey, setCinemaKey] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const lastCinemaStampRef = useRef(0);

  /* detail (episode list) */
  useEffect(() => {
    const contentId = room?.content.contentId;
    if (!contentId) return;
    let active = true;
    const path = isFilmContentId(contentId)
      ? `/api/film/${encodeURIComponent(contentId)}`
      : `/api/anime/${encodeURIComponent(contentId)}`;
    apiGet<RoomDetail>(path)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [room?.content.contentId]);

  /* stream for the current episode */
  useEffect(() => {
    const contentId = room?.content.contentId;
    if (!contentId || !currentEpisodeId) return;
    let active = true;
    setStreamLoading(true);
    setStreamError(null);
    setResolution(null);

    const streamPath = isFilmContentId(contentId)
      ? `/api/film/${encodeURIComponent(contentId)}/episodes/${encodeURIComponent(currentEpisodeId)}/stream`
      : `/api/anime/${encodeURIComponent(contentId)}/episodes/${encodeURIComponent(currentEpisodeId)}/stream`;
    apiGet<EpisodeStreamResolution>(streamPath)
      .then((data) => {
        if (active) setResolution(data);
      })
      .catch((err) => {
        if (active) setStreamError(errorMessage(err));
      })
      .finally(() => {
        if (active) setStreamLoading(false);
      });

    return () => {
      active = false;
    };
  }, [room?.content.contentId, currentEpisodeId]);

  const saveProgress = useCallback(
    (position: number, duration: number) => {
      if (!user || !room || !currentEpisodeId) return;
      void apiPost("/api/me/history", {
        contentId: room.content.contentId,
        episodeId: currentEpisodeId,
        position,
        duration,
      }).catch(() => undefined);
    },
    [user, room, currentEpisodeId]
  );

  const handlePlayingChange = useCallback(
    (playing: boolean, position: number) => {
      if (!isHost) return;
      if (playing) hostPlay(position);
      else hostPause(position);
    },
    [isHost, hostPlay, hostPause]
  );

  const handleSeek = useCallback(
    (position: number) => {
      if (isHost) hostSeek(position);
    },
    [isHost, hostSeek]
  );

  const copyInviteLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Tautan undangan disalin!", "success");
    } catch {
      toast("Gagal menyalin tautan. Salin manual dari address bar.", "error");
    }
  }, [toast]);

  const episodes = useMemo(() => roomEpisodesOf(detail), [detail]);
  const isFilmRoom = isFilmContentId(room?.content.contentId);

  const currentEpisode = useMemo(() => {
    if (!currentEpisodeId) return null;
    return episodes.find((item) => item.id === currentEpisodeId) ?? null;
  }, [episodes, currentEpisodeId]);

  /*
   * Sinyal "mulai bareng" memakai kanal sinkronisasi yang sudah ada: host
   * mengirim hostPlay(0) dan setiap peserta menampilkan hitung mundur 3-2-1
   * dari stempel waktu server yang sama, lalu player dimuat ulang.
   */
  useEffect(() => {
    // Host memulai hitung mundur secara lokal (server tidak mengirim gema ke pengirim),
    // peserta mengikuti sinyal sinkronisasi yang sama.
    if (!isFilmRoom || isHost || !sync?.isPlaying) return;
    const stamp = sync.updatedAt ?? 0;
    if (stamp <= lastCinemaStampRef.current) return;
    lastCinemaStampRef.current = stamp;
    setCountdown(3);
  }, [isFilmRoom, isHost, sync]);

  /** Host: mulai hitung mundur lokal + beri tahu peserta lewat kanal sinkronisasi. */
  const startCinema = useCallback(() => {
    setCountdown(3);
    hostPlay(0);
  }, [hostPlay]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCinemaKey((key) => key + 1);
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => Math.max(0, (value ?? 1) - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  /* ------------------------------ guards ------------------------------ */

  if (loading) {
    return (
      <div className="space-y-6 pt-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-[480px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          title="Room tidak ditemukan"
          description={error ?? "Room ini mungkin sudah berakhir atau tautannya salah."}
          action={
            <Link href="/nobar" className="btn btn-primary">
              Kembali ke daftar nobar
            </Link>
          }
        />
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          title="Masuk untuk ikut nobar"
          description={`Room “${room.roomName}” sedang berlangsung. Masuk atau daftar dulu untuk bergabung ke room dan ikut mengobrol.`}
          action={
            <div className="flex gap-3">
              <Link href={`/login?next=/nobar/room/${roomId}`} className="btn btn-primary">
                Masuk
              </Link>
              <Link href="/register" className="btn btn-outline">
                Daftar
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const anime = room.content.anime;
  const episode = currentEpisode ?? room.content.episode;

  if (ended) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          title="Room ini telah berakhir"
          description={`Terima kasih sudah nobar di “${room.roomName}”. Kamu bisa membuat room baru atau menonton sendiri.`}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/nobar/create" className="btn btn-primary">
                Buat Room Baru
              </Link>
              <Link
                href={
                  isFilmContentId(room.content.contentId)
                    ? `/film/${room.content.contentId}`
                    : `/anime/${room.content.contentId}`
                }
                className="btn btn-outline"
              >
                Lihat Detail
              </Link>
              <Link href="/nobar" className="btn btn-ghost">
                Daftar Nobar
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const picked = resolution?.picked ?? null;
  const playable = playableSource(picked);

  return (
    <div className="space-y-5 pt-4">
      {/* header */}
      <div className="panel flex flex-col gap-4 rounded-2xl p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300">
              <span className="live-dot !h-1.5 !w-1.5" />
              {connected ? "Live" : "Menghubungkan…"}
            </span>
            {room.privacy === "private" ? <span className="chip">Privat</span> : null}
            {!connected ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400">
                <Spinner size={11} /> menyambung ulang…
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 truncate text-xl font-extrabold tracking-tight text-fog-50 sm:text-2xl">
            {room.roomName}
          </h1>
          <p className="mt-1 truncate text-sm text-fog-400">
            {anime?.title ?? "Anime"}
            <span className="text-fog-600"> · {episodeLabel(episode)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3">
            <Avatar name={room.host.username} color={room.host.avatarColor} size="sm" />
            <span className="text-[11px] font-semibold text-fog-300">
              {room.host.username}
              {isHost ? " (kamu)" : ""}
            </span>
            <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
              Host
            </span>
          </div>

          <button type="button" onClick={() => void copyInviteLink()} className="btn btn-outline !py-2.5 text-xs">
            Salin Tautan
          </button>

          {isHost ? (
            <>
              {episodes.length > 1 ? (
                <select
                  value={currentEpisodeId ?? ""}
                  onChange={(event) => hostChangeEpisode(event.target.value)}
                  className="input !w-auto !py-2.5 text-xs"
                  aria-label="Ganti episode"
                >
                  {episodes.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {item.number ? `Ep ${item.number}` : `Ep ${index + 1}`}
                    </option>
                  ))}
                </select>
              ) : null}

              {confirmEnd ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      endRoom();
                      setConfirmEnd(false);
                    }}
                    className="btn btn-danger !py-2.5 text-xs"
                  >
                    Yakin, akhiri
                  </button>
                  <button type="button" onClick={() => setConfirmEnd(false)} className="btn btn-ghost !py-2.5 text-xs">
                    Batal
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmEnd(true)} className="btn btn-danger !py-2.5 text-xs">
                  Akhiri Room
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-400">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold" aria-label="Tutup">
            ×
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {streamLoading ? (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900">
              {anime?.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={anime.posterUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-15 blur-xl"
                />
              ) : null}
              <div className="relative flex flex-col items-center gap-3 text-center">
                <Spinner size={38} className="border-[3px]" />
                <p className="text-sm font-semibold text-fog-200">Menyiapkan server video…</p>
                <p className="text-xs text-fog-500">Biasanya 5–15 detik. Semua peserta akan tersinkron otomatis.</p>
              </div>
            </div>
          ) : streamError ? (
            <div className="panel flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl px-6 text-center">
              <p className="text-sm font-semibold text-rose-400">{streamError}</p>
              {isHost ? (
                <p className="max-w-sm text-xs text-fog-500">
                  Coba ganti episode lain atau muat ulang halaman.
                </p>
              ) : (
                <p className="max-w-sm text-xs text-fog-500">
                  Host dapat mencoba mengganti episode. Tunggu sebentar ya.
                </p>
              )}
            </div>
          ) : (
            <div className="relative">
              <VideoPlayer
                ref={playerRef}
                key={isFilmRoom ? cinemaKey : undefined}
                source={playable}
                poster={anime?.posterUrl}
                roomMode={!isFilmRoom}
                canControl={isFilmRoom ? false : isHost}
                syncTarget={isFilmRoom ? null : sync}
                onPlayingChange={isFilmRoom ? undefined : handlePlayingChange}
                onSeek={isFilmRoom ? undefined : handleSeek}
                onProgress={saveProgress}
              />
              {isFilmRoom && countdown !== null ? (
                <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-ink-950/88">
                  <div className="text-center">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fog-500">
                      Mulai bareng
                    </p>
                    <p className="mt-2 text-6xl font-extrabold tracking-tight text-accent-400">
                      {countdown}
                    </p>
                    <p className="mt-3 text-xs text-fog-400">
                      Setelah hitungan selesai, tekan tombol putar di player mitra.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {isFilmRoom ? (
            <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">Mode sinema</p>
                <p className="mt-1 text-xs leading-relaxed text-fog-400">
                  Film diputar oleh player mitra di perangkat masing-masing. Host mengatur judul &
                  episode; tekan “Mulai Bareng” agar semua peserta mulai pada waktu yang sama.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {isHost ? (
                  <button type="button" onClick={startCinema} className="btn btn-primary !py-2.5 text-xs">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
                    </svg>
                    Mulai Bareng
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCinemaKey((key) => key + 1)}
                  className="btn btn-outline !py-2.5 text-xs"
                >
                  Muat ulang player
                </button>
              </div>
            </div>
          ) : null}

          <div className="panel space-y-3 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">
                Peserta · {participants.length}
              </p>
              {picked ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-fog-600">
                  Sumber: {picked.label ?? picked.type.toUpperCase()}
                </span>
              ) : null}
            </div>
            <RoomParticipants participants={participants} />
          </div>

          {isHost && episodes.length > 1 ? (
            <div className="panel space-y-3 rounded-2xl p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">
                Ganti Episode (Host)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {episodes.map((item, index) => {
                  const active = item.id === currentEpisodeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => hostChangeEpisode(item.id)}
                      className={`shrink-0 rounded-xl border px-3 py-2 font-mono text-xs font-bold transition-all ${
                        active
                          ? "border-accent-500/70 bg-accent-500/15 text-accent-300"
                          : "border-white/[0.08] bg-white/[0.03] text-fog-300 hover:border-accent-500/40"
                      }`}
                    >
                      {item.number ?? index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="panel flex h-[520px] flex-col overflow-hidden rounded-2xl lg:h-[640px]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">Obrolan Room</p>
            <span className="font-mono text-[10px] text-fog-600">{messages.length} pesan</span>
          </div>
          <RoomChat
            messages={messages}
            onSend={sendChat}
            currentUserId={user?.id ?? null}
            disabled={!user}
            className="min-h-0 flex-1"
          />
        </aside>
      </div>
    </div>
  );
}
