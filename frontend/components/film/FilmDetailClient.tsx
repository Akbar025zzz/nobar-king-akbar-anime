"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, errorMessage } from "@/lib/api";
import type { FilmDetail, FilmEpisode } from "@/lib/types";

/**
 * Bagian interaktif halaman detail film: pilih season, daftar episode, trailer,
 * dan tombol aksi (tonton / buat nobar).
 *
 * Kalau daftar episode gagal dimuat, yang tampil adalah pesan kesalahan yang
 * jujur — bukan daftar contoh.
 */
export function FilmDetailClient({ film }: { film: FilmDetail }) {
  const [season, setSeason] = useState<number | null>(film.activeSeason ?? film.seasons[0]?.season ?? null);
  const [episodes, setEpisodes] = useState<FilmEpisode[]>(film.episodes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);

  useEffect(() => {
    setEpisodes(film.episodes);
    setSeason(film.activeSeason ?? film.seasons[0]?.season ?? null);
  }, [film]);

  const selectSeason = async (next: number) => {
    if (next === season) return;
    setSeason(next);
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<FilmDetail>(
        `/api/film/${encodeURIComponent(film.id)}?season=${encodeURIComponent(String(next))}`
      );
      setEpisodes(data.episodes);
    } catch (caught) {
      setEpisodes([]);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const watchHref = useMemo(() => {
    if (film.kind === "movie") return `/watch/${encodeURIComponent(film.id)}/movie`;
    const first = episodes[0];
    return `/watch/${encodeURIComponent(film.id)}/${encodeURIComponent(first?.id ?? "s1e1")}`;
  }, [film.id, film.kind, episodes]);

  const nobarHref = useMemo(() => {
    const episodeId = film.kind === "movie" ? "movie" : (episodes[0]?.id ?? "s1e1");
    return `/nobar/create?contentId=${encodeURIComponent(film.id)}&episodeId=${encodeURIComponent(episodeId)}`;
  }, [film.id, film.kind, episodes]);

  return (
    <div className="mt-7 space-y-8">
      <div className="flex flex-wrap gap-3">
        <Link href={watchHref} className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
          </svg>
          Tonton sekarang
        </Link>
        <Link href={nobarHref} className="btn btn-outline">
          Buat Nobar
        </Link>
        {film.trailerYoutubeKey ? (
          <button type="button" onClick={() => setTrailerOpen((open) => !open)} className="btn btn-ghost">
            {trailerOpen ? "Tutup trailer" : "Lihat trailer"}
          </button>
        ) : null}
      </div>

      {trailerOpen && film.trailerYoutubeKey ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950">
          <div className="aspect-video w-full">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${film.trailerYoutubeKey}?rel=0`}
              title={`Trailer ${film.title}`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}

      {film.kind === "series" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Episode</p>
              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-fog-50">
                {film.seasons.find((item) => item.season === season)?.name ?? "Season 1"}
              </h2>
            </div>
            {film.seasons.length > 1 ? (
              <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
                {film.seasons.map((item) => (
                  <button
                    key={item.season}
                    type="button"
                    onClick={() => void selectSeason(item.season)}
                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      item.season === season
                        ? "border-accent-500/50 bg-accent-500/12 text-accent-300"
                        : "border-white/[0.08] text-fog-400 hover:border-accent-500/30 hover:text-fog-100"
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className="skeleton h-[86px] rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <p className="panel rounded-2xl p-4 text-sm text-rose-300">{error}</p>
          ) : episodes.length === 0 ? (
            <p className="panel rounded-2xl p-4 text-sm text-fog-400">
              Belum ada daftar episode yang bisa dimuat untuk season ini.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((episode) => (
                <Link
                  key={episode.id}
                  href={`/watch/${encodeURIComponent(film.id)}/${encodeURIComponent(episode.id)}`}
                  className="group panel flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-500/35"
                >
                  <span className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-ink-800">
                    {episode.stillUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={episode.stillUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-fog-600">
                      Episode {episode.number}
                      {episode.runtimeMinutes ? ` · ${episode.runtimeMinutes}m` : ""}
                    </span>
                    <span className="mt-1 block truncate text-[13px] font-semibold text-fog-100 group-hover:text-accent-300">
                      {episode.title ?? `Episode ${episode.number}`}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
