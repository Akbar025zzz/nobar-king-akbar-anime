"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { episodeLabel } from "@/lib/format";
import { playableSource } from "@/lib/stream";
import type { AnimeDetail, EpisodeStreamResolution } from "@/lib/types";

interface WatchClientProps {
  detail: AnimeDetail;
  episodeId: string;
}

export function WatchClient({ detail, episodeId }: WatchClientProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const episode = useMemo(
    () => detail.episodes.find((item) => item.id === episodeId) ?? detail.episodes[0] ?? null,
    [detail.episodes, episodeId]
  );

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

    apiGet<EpisodeStreamResolution>(
      `/api/anime/${encodeURIComponent(detail.id)}/episodes/${encodeURIComponent(episode.id)}/stream`
    )
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
  }, [detail.id, episode?.id, attempt]);

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

  const currentIndex = episode ? detail.episodes.findIndex((item) => item.id === episode.id) : -1;
  const previousEpisode = currentIndex > 0 ? detail.episodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < detail.episodes.length - 1 ? detail.episodes[currentIndex + 1] : null;

  if (!episode) {
    return (
      <div className="panel mt-4 rounded-3xl p-10 text-center">
        <p className="text-sm text-fog-400">Judul ini belum memiliki episode yang bisa ditonton.</p>
        <Link href={`/anime/${detail.id}`} className="btn btn-outline mt-4">
          Kembali ke detail
        </Link>
      </div>
    );
  }

  const picked = resolution?.picked ?? null;
  const playable = playableSource(picked);

  return (
    <div className="space-y-6 pt-4">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-fog-500">
        <Link href="/explore" className="transition-colors hover:text-accent-400">
          Jelajah
        </Link>
        <span className="text-fog-700">/</span>
        <Link href={`/anime/${detail.id}`} className="max-w-[220px] truncate transition-colors hover:text-accent-400">
          {detail.title}
        </Link>
        <span className="text-fog-700">/</span>
        <span className="text-fog-300">{episodeLabel(episode)}</span>
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
                  <p className="text-sm font-semibold text-fog-200">Menyiapkan server video…</p>
                  <p className="mt-1 text-xs text-fog-500">
                    Sistem memilih server tercepat secara otomatis (biasanya 5–15 detik).
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="panel flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl px-6 text-center">
              <p className="text-sm font-semibold text-rose-400">{error}</p>
              <p className="max-w-sm text-xs text-fog-500">
                Server sumber sedang tidak dapat dijangkau. Coba lagi atau pilih episode lain.
              </p>
              <button type="button" className="btn btn-outline" onClick={() => setAttempt((value) => value + 1)}>
                Coba lagi
              </button>
            </div>
          ) : (
            <VideoPlayer
              source={playable}
              poster={detail.posterUrl}
              autoPlay
              canControl
              onProgress={saveProgress}
              onEnded={() => {
                if (nextEpisode) {
                  toast(`Lanjut ke ${episodeLabel(nextEpisode)}…`, "info");
                }
              }}
            />
          )}

          <div className="panel rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-fog-50">{detail.title}</h1>
                <p className="mt-1 text-sm text-fog-400">{episodeLabel(episode)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/nobar/create?contentId=${detail.id}&episodeId=${episode.id}`}
                  className="btn btn-primary !py-2.5 text-xs"
                >
                  Buat Nobar Episode Ini
                </Link>
                <Link href={`/anime/${detail.id}`} className="btn btn-outline !py-2.5 text-xs">
                  Detail Anime
                </Link>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {previousEpisode ? (
                <Link href={`/watch/${detail.id}/${previousEpisode.id}`} className="btn btn-ghost !py-2 text-xs">
                  ← {episodeLabel(previousEpisode)}
                </Link>
              ) : null}
              {nextEpisode ? (
                <Link href={`/watch/${detail.id}/${nextEpisode.id}`} className="btn btn-ghost !py-2 text-xs">
                  {episodeLabel(nextEpisode)} →
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
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">Daftar Episode</p>
            <p className="mt-0.5 text-xs text-fog-500">{detail.episodes.length} episode tersedia</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {detail.episodes.map((item, index) => {
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
          </div>
        </aside>
      </div>
    </div>
  );
}
