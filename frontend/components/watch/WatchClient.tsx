"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { episodeLabel } from "@/lib/format";
import { playableSource } from "@/lib/stream";
import type { AnimeDetail, AnimeEpisode, EpisodeStreamResolution, FilmDetail } from "@/lib/types";

type WatchDetail = AnimeDetail | FilmDetail;

interface WatchClientProps {
  detail: WatchDetail;
  episodeId: string;
}

interface WatchEpisode {
  id: string;
  number: number | null;
  title: string | null;
}

export function WatchClient({ detail, episodeId }: WatchClientProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const isFilm = detail.id.startsWith("tmdb:");
  const filmKind = isFilm ? (detail as FilmDetail).kind : null;

  /** Film tunggal tidak punya daftar episode: satu "episode" = film itu sendiri. */
  const episodes = useMemo<WatchEpisode[]>(() => {
    if (!isFilm) return (detail as AnimeDetail).episodes;
    if (filmKind === "movie") {
      return [{ id: "movie", number: null, title: detail.title }];
    }
    return (detail as FilmDetail).episodes.map((episode) => ({
      id: episode.id,
      number: episode.number,
      title: episode.title,
    }));
  }, [detail, filmKind, isFilm]);

  const episode = useMemo(
    () => episodes.find((item) => item.id === episodeId) ?? episodes[0] ?? null,
    [episodes, episodeId]
  );

  /** Ringkasan metadata film untuk panel samping (hanya dipakai bila konten film). */
  const filmInfo = useMemo(() => {
    if (!isFilm) return null;
    const film = detail as FilmDetail;
    const meta = [
      film.year,
      film.kind === "movie"
        ? film.runtimeMinutes
          ? `${film.runtimeMinutes} menit`
          : null
        : `${film.seasons.length} musim`,
      film.score ? `★ ${film.score.toFixed(1)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { meta, genres: film.genres.slice(0, 4) };
  }, [detail, isFilm]);

  const [resolution, setResolution] = useState<EpisodeStreamResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!episode) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setResolution(null);
    savedRef.current = false;

    const path = isFilm
      ? `/api/film/${encodeURIComponent(detail.id)}/episodes/${encodeURIComponent(episode.id)}/stream`
      : `/api/anime/${encodeURIComponent(detail.id)}/episodes/${encodeURIComponent(episode.id)}/stream`;

    apiGet<EpisodeStreamResolution>(path)
      .then((data) => {
        if (active) setResolution(data);
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
  }, [detail.id, episode?.id, attempt, isFilm]);

  const saveProgress = useCallback(
    (position: number, duration: number) => {
      if (!user || !episode) return;
      void apiPost("/api/me/history", {
        contentId: detail.id,
        episodeId: episode.id,
        position,
        duration,
      }).catch(() => undefined);
    },
    [user, detail.id, episode]
  );

  const currentIndex = episode ? episodes.findIndex((item) => item.id === episode.id) : -1;
  const previousEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

  const detailHref = isFilm ? `/film/${detail.id}` : `/anime/${detail.id}`;

  if (!episode) {
    return (
      <div className="panel mt-4 rounded-3xl p-10 text-center">
        <p className="text-sm text-fog-400">Judul ini belum memiliki episode yang bisa ditonton.</p>
        <Link href={detailHref} className="btn btn-outline mt-4">
          Kembali ke detail
        </Link>
      </div>
    );
  }

  const picked = resolution?.picked ?? null;
  const playable = playableSource(picked);
  const isEmbed = playable?.type === "iframe" || playable?.type === "embed";

  return (
    <div className="space-y-6 pt-4">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-fog-500">
        <Link href={isFilm ? "/film" : "/explore"} className="transition-colors hover:text-accent-400">
          {isFilm ? "Film" : "Jelajah"}
        </Link>
        <span className="text-fog-700">/</span>
        <Link href={detailHref} className="max-w-[220px] truncate transition-colors hover:text-accent-400">
          {detail.title}
        </Link>
        {episode.number !== null || !isFilm ? (
          <>
            <span className="text-fog-700">/</span>
            <span className="text-fog-300">{episodeLabel(episode as AnimeEpisode)}</span>
          </>
        ) : null}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {loading ? (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900">
              {detail.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 blur-xl" />
              ) : null}
              <div className="relative flex flex-col items-center gap-4 px-6 text-center">
                <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-accent-500" />
                <div>
                  <p className="text-sm font-semibold text-fog-200">
                    {isFilm ? "Menyiapkan player mitra…" : "Menyiapkan server video…"}
                  </p>
                  <p className="mt-1 text-xs text-fog-500">
                    {isFilm
                      ? "Film diputar lewat player penyedia mitra."
                      : "Sistem memilih server tercepat secara otomatis (biasanya 5–15 detik)."}
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="panel flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl px-6 text-center">
              <p className="text-sm font-semibold text-rose-400">{error}</p>
              <p className="max-w-sm text-xs text-fog-500">
                {isFilm
                  ? "Player mitra sedang tidak bisa dijangkau. Coba lagi sebentar lagi."
                  : "Server sumber sedang tidak dapat dijangkau. Coba lagi atau pilih episode lain."}
              </p>
              <button type="button" className="btn btn-outline" onClick={() => setAttempt((value) => value + 1)}>
                Coba lagi
              </button>
            </div>
          ) : (
            <VideoPlayer
              source={playable}
              poster={detail.posterUrl}
              autoPlay={!isEmbed}
              canControl
              onProgress={saveProgress}
              onEnded={() => {
                if (nextEpisode) {
                  toast(`Lanjut ke ${episodeLabel(nextEpisode as AnimeEpisode)}…`, "info");
                }
              }}
            />
          )}

          {isFilm && resolution && resolution.sources.length > 1 ? (
            <div className="panel flex flex-wrap items-center gap-2 rounded-2xl p-3.5">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-fog-600">
                Ganti server
              </span>
              {resolution.sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setResolution({ ...resolution, picked: source })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    source.id === resolution.picked?.id
                      ? "border-accent-500/50 bg-accent-500/12 text-accent-300"
                      : "border-white/[0.08] text-fog-400 hover:border-accent-500/30 hover:text-fog-100"
                  }`}
                >
                  {source.label ?? source.server ?? "Server"}
                </button>
              ))}
            </div>
          ) : null}

          <div className="panel rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-fog-50">{detail.title}</h1>
                <p className="mt-1 text-sm text-fog-400">
                  {isFilm
                    ? filmKind === "movie"
                      ? "Film"
                      : episodeLabel(episode as AnimeEpisode)
                    : episodeLabel(episode as AnimeEpisode)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/nobar/create?contentId=${encodeURIComponent(detail.id)}&episodeId=${encodeURIComponent(episode.id)}`}
                  className="btn btn-primary !py-2.5 text-xs"
                >
                  Buat Nobar {isFilm ? "" : "Episode Ini"}
                </Link>
                <Link href={detailHref} className="btn btn-outline !py-2.5 text-xs">
                  {isFilm ? "Detail Film" : "Detail Anime"}
                </Link>
              </div>
            </div>

            {isFilm ? (
              <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-fog-500">
                Pemutaran film memakai player penyedia mitra. Kontrol putar/jeda berada di player
                tersebut, jadi ruang nobar film memakai mode sinema (hitung mundur mulai bareng +
                obrolan realtime).
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {previousEpisode ? (
                <Link
                  href={`/watch/${detail.id}/${previousEpisode.id}`}
                  className="btn btn-ghost !py-2 text-xs"
                >
                  ← {episodeLabel(previousEpisode as AnimeEpisode)}
                </Link>
              ) : null}
              {nextEpisode ? (
                <Link href={`/watch/${detail.id}/${nextEpisode.id}`} className="btn btn-ghost !py-2 text-xs">
                  {episodeLabel(nextEpisode as AnimeEpisode)} →
                </Link>
              ) : null}
              {picked ? (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-fog-600">
                  Sumber: {picked.label ?? picked.type.toUpperCase()}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="panel flex max-h-[640px] flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.07] px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">
              {isFilm && filmKind === "movie" ? "Judul" : "Daftar Episode"}
            </p>
            <p className="mt-0.5 text-xs text-fog-500">
              {isFilm && filmKind === "movie"
                ? "Film tunggal"
                : `${episodes.length} episode tersedia`}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {episodes.map((item, index) => {
              const active = item.id === episode.id;
              return (
                <Link
                  key={item.id}
                  href={`/watch/${detail.id}/${item.id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-accent-500/12 text-accent-200" : "text-fog-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold ${
                      active ? "bg-accent-500 text-ink-950" : "bg-white/[0.06] text-fog-400"
                    }`}
                  >
                    {item.number ?? index + 1}
                  </span>
                  <span className="truncate">{item.title ?? `Episode ${item.number ?? index + 1}`}</span>
                  {active ? (
                    <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-accent-400">
                      Diputar
                    </span>
                  ) : null}
                </Link>
              );
            })}
            {filmInfo ? (
              <div className="mt-2 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Tentang judul</p>
                <p className="text-xs leading-relaxed text-fog-400">{filmInfo.meta}</p>
                {filmInfo.genres.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filmInfo.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-md border border-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fog-500"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Link
                  href={`/film/${detail.id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-400 hover:text-accent-300"
                >
                  Lihat detail film
                  <span aria-hidden>→</span>
                </Link>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
