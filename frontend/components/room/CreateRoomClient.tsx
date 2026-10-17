"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { episodeLabel } from "@/lib/format";
import type { AnimeCard, AnimeDetail, FilmCard, FilmDetail, RoomDTO } from "@/lib/types";

interface CreateRoomClientProps {
  initialContentId: string | null;
  initialEpisodeId: string | null;
}

type RoomDetail = AnimeDetail | FilmDetail;

interface EpisodeOption {
  id: string;
  number: number | null;
  title: string | null;
}

interface SearchItem {
  id: string;
  title: string;
  posterUrl: string | null;
  year: string | null;
  kindLabel: string;
}

function isFilmId(contentId: string | null): boolean {
  return Boolean(contentId && contentId.startsWith("tmdb:"));
}

function episodeOptionsOf(detail: RoomDetail, film: FilmDetail | null): EpisodeOption[] {
  if (!film) return (detail as AnimeDetail).episodes;
  if (film.kind === "movie") {
    return [{ id: "movie", number: null, title: film.title }];
  }
  return film.episodes.map((episode) => ({
    id: episode.id,
    number: episode.number,
    title: episode.title,
  }));
}

export function CreateRoomClient({ initialContentId, initialEpisodeId }: CreateRoomClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [contentId, setContentId] = useState<string | null>(initialContentId);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(initialContentId));
  const [episodeId, setEpisodeId] = useState<string | null>(initialEpisodeId);
  const [roomName, setRoomName] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [creating, setCreating] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const filmDetail = detail && isFilmId(detail.id) ? (detail as FilmDetail) : null;
  const episodes = detail ? episodeOptionsOf(detail, filmDetail) : [];

  /* load detail whenever a content is selected */
  useEffect(() => {
    if (!contentId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    const path = isFilmId(contentId)
      ? `/api/film/${encodeURIComponent(contentId)}`
      : `/api/anime/${encodeURIComponent(contentId)}`;
    apiGet<RoomDetail>(path)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        const options = episodeOptionsOf(data, isFilmId(data.id) ? (data as FilmDetail) : null);
        setEpisodeId((current) => {
          if (current && options.some((item) => item.id === current)) return current;
          return options[0]?.id ?? null;
        });
        setRoomName((current) => {
          if (current.trim()) return current;
          // Episode dari tautan lebih diprioritaskan daripada episode pertama.
          const chosen = options.find((item) => item.id === episodeId) ?? options[0] ?? null;
          return chosen
            ? `Nobar ${data.title}${chosen.number !== null ? ` — ${episodeLabel(chosen)}` : ""}`
            : `Nobar ${data.title}`;
        });
      })
      .catch((error) => {
        if (active) toast(errorMessage(error), "error");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contentId, toast]);

  /* debounced search: anime + film sekaligus */
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const encoded = encodeURIComponent(trimmed);
      const [animeResult, filmResult] = await Promise.allSettled([
        apiGet<AnimeCard[]>(`/api/anime/search?q=${encoded}`),
        apiGet<FilmCard[]>(`/api/film/search?q=${encoded}`),
      ]);

      const merged: SearchItem[] = [];
      if (animeResult.status === "fulfilled") {
        merged.push(
          ...animeResult.value.map((item) => ({
            id: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            year: item.year,
            kindLabel: item.kind ?? "Anime",
          }))
        );
      }
      if (filmResult.status === "fulfilled") {
        merged.push(
          ...filmResult.value.map((item) => ({
            id: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            year: item.year,
            kindLabel: item.kind === "series" ? "Series" : "Film",
          }))
        );
      }

      setResults(merged.slice(0, 10));
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const create = useCallback(async () => {
    if (!contentId) {
      toast("Pilih judul terlebih dahulu.", "error");
      return;
    }
    if (!episodeId) {
      toast("Pilih episode yang akan ditonton.", "error");
      return;
    }
    setCreating(true);
    try {
      const room = await apiPost<RoomDTO>("/api/rooms", {
        contentId,
        episodeId,
        roomName: roomName.trim() || undefined,
        privacy,
      });
      toast("Room berhasil dibuat!", "success");
      router.push(`/nobar/room/${room.id}`);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setCreating(false);
    }
  }, [contentId, episodeId, roomName, privacy, router, toast]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          title="Masuk untuk membuat room nobar"
          description="Room nobar terhubung dengan akunmu agar peserta bisa melihat siapa host-nya."
          action={
            <div className="flex gap-3">
              <Link href="/login?next=/nobar/create" className="btn btn-primary">
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-4">
      <header>
        <p className="section-kicker">Nonton bareng</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fog-50">Buat Room Nobar</h1>
        <p className="mt-3 text-sm leading-relaxed text-fog-400">
          Pilih judul anime atau film, tentukan episode, atur nama room, lalu bagikan tautannya. Anime
          diputar tersinkron penuh oleh host; film memakai mode sinema dengan hitung mundur mulai bareng.
        </p>
      </header>

      <section className="panel space-y-4 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-fog-100">1 · Pilih Judul</h2>
          {detail ? (
            <button
              type="button"
              className="text-xs font-semibold text-accent-400 hover:text-accent-300"
              onClick={() => {
                setContentId(null);
                setDetail(null);
                setEpisodeId(null);
                setRoomName("");
              }}
            >
              Ganti judul
            </button>
          ) : null}
        </div>

        {!contentId ? (
          <div className="space-y-3">
            <div className="relative">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari anime atau film… (contoh: naruto, the raid)"
                className="input pl-9"
              />
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-600"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {searching ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size={14} />
                </span>
              ) : null}
            </div>

            {results.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setContentId(item.id)}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2 text-left transition-colors hover:border-accent-500/40 hover:bg-accent-500/5"
                  >
                    <span className="poster-frame h-14 w-10 shrink-0 overflow-hidden rounded-lg">
                      {item.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fog-100">{item.title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-fog-600">
                        {[item.kindLabel, item.year].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : query.trim().length >= 2 && !searching ? (
              <p className="text-xs text-fog-600">Tidak ada hasil untuk pencarian itu.</p>
            ) : (
              <p className="text-xs text-fog-600">
                Atau langsung buka{" "}
                <Link href="/film" className="text-accent-400 hover:text-accent-300">
                  katalog film
                </Link>{" "}
                dan pilih “Buat Nobar” dari sana.
              </p>
            )}
          </div>
        ) : detailLoading ? (
          <div className="flex items-center gap-3 py-4 text-sm text-fog-500">
            <Spinner size={16} /> Memuat detail judul…
          </div>
        ) : detail ? (
          <div className="flex items-center gap-4">
            <span className="poster-frame h-[92px] w-[64px] shrink-0 overflow-hidden rounded-xl">
              {detail.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.posterUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-fog-50">{detail.title}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fog-600">
                {[
                  filmDetail ? (filmDetail.kind === "series" ? "Series" : "Film") : detail.kind,
                  detail.year,
                  filmDetail?.kind === "movie" ? "Film tunggal" : `${episodes.length} episode`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {detail ? (
        <section className="panel space-y-4 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-fog-100">
            2 · {filmDetail?.kind === "movie" ? "Konfirmasi Judul" : "Pilih Episode"}
          </h2>
          {episodes.length === 0 ? (
            <p className="text-xs text-fog-600">Judul ini belum memiliki episode.</p>
          ) : filmDetail?.kind === "movie" ? (
            <button
              type="button"
              onClick={() => setEpisodeId(episodes[0].id)}
              className="flex w-full items-center justify-between rounded-xl border border-accent-500/70 bg-accent-500/15 px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-accent-200">{detail.title}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent-300">Siap ditonton</span>
            </button>
          ) : (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8">
              {episodes.map((episode, index) => {
                const active = episode.id === episodeId;
                return (
                  <button
                    key={episode.id}
                    type="button"
                    onClick={() => {
                      setEpisodeId(episode.id);
                      setRoomName((current) => {
                        if (!current.trim() || current.startsWith("Nobar ")) {
                          return `Nobar ${detail.title} — ${episodeLabel(episode)}`;
                        }
                        return current;
                      });
                    }}
                    className={`flex flex-col items-center rounded-xl border px-2 py-2.5 transition-all ${
                      active
                        ? "border-accent-500/70 bg-accent-500/15"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-accent-500/40"
                    }`}
                  >
                    <span className={`font-mono text-sm font-bold ${active ? "text-accent-300" : "text-fog-200"}`}>
                      {episode.number ?? index + 1}
                    </span>
                    <span className="mt-0.5 font-mono text-[8px] uppercase tracking-widest text-fog-600">
                      Episode
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {detail ? (
        <section className="panel space-y-5 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-fog-100">3 · Pengaturan Room</h2>

          <div>
            <label htmlFor="roomName" className="mb-1.5 block text-xs font-semibold text-fog-400">
              Nama room
            </label>
            <input
              id="roomName"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              maxLength={80}
              placeholder="Contoh: Nobar Seru Malam Ini"
              className="input"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-fog-400">Privasi</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPrivacy("public")}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  privacy === "public"
                    ? "border-accent-500/70 bg-accent-500/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="text-sm font-bold text-fog-100">Publik</span>
                <span className="mt-1 block text-xs leading-relaxed text-fog-500">
                  Tampil di daftar room live, siapa pun bisa bergabung.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPrivacy("private")}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  privacy === "private"
                    ? "border-accent-500/70 bg-accent-500/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="text-sm font-bold text-fog-100">Privat</span>
                <span className="mt-1 block text-xs leading-relaxed text-fog-500">
                  Hanya bisa diakses lewat tautan undangan yang kamu bagikan.
                </span>
              </button>
            </div>
          </div>

          {filmDetail ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-fog-500">
              Mode sinema: film diputar lewat player mitra di perangkat masing-masing peserta. Host
              memilih judul/season/episode dan semua peserta mulai bersama lewat hitung mundur, plus
              obrolan realtime.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !episodeId}
            className="btn btn-primary w-full"
          >
            {creating ? (
              <>
                <Spinner size={15} /> Membuat room…
              </>
            ) : (
              "Buat Room & Mulai Nobar"
            )}
          </button>
        </section>
      ) : null}
    </div>
  );
}
