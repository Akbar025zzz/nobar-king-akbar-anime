"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiDelete, apiGet, errorMessage } from "@/lib/api";
import { formatRelativeTime, progressWidth } from "@/lib/format";
import type { FavoriteRef, HistoryEntry } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { toast } = useToast();

  const [favorites, setFavorites] = useState<FavoriteRef[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setDataLoading(false);
      return;
    }
    let active = true;
    setDataLoading(true);
    Promise.all([
      apiGet<FavoriteRef[]>("/api/me/favorites").catch(() => [] as FavoriteRef[]),
      apiGet<HistoryEntry[]>("/api/me/history").catch(() => [] as HistoryEntry[]),
    ])
      .then(([favoriteItems, historyItems]) => {
        if (!active) return;
        setFavorites(favoriteItems);
        setHistory(historyItems);
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const removeFavorite = useCallback(
    async (contentId: string) => {
      try {
        await apiDelete(`/api/me/favorites/${encodeURIComponent(contentId)}`);
        setFavorites((current) => current.filter((item) => item.contentId !== contentId));
        toast("Dihapus dari favorit.", "success");
      } catch (error) {
        toast(errorMessage(error), "error");
      }
    },
    [toast]
  );

  const removeHistoryEntry = useCallback(
    async (contentId: string) => {
      try {
        await apiDelete(`/api/me/history/${encodeURIComponent(contentId)}`);
        setHistory((current) => current.filter((item) => item.contentId !== contentId));
        toast("Riwayat dihapus.", "success");
      } catch (error) {
        toast(errorMessage(error), "error");
      }
    },
    [toast]
  );

  const clearAllHistory = useCallback(async () => {
    try {
      await apiDelete("/api/me/history");
      setHistory([]);
      toast("Semua riwayat dibersihkan.", "success");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }, [toast]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          title="Masuk untuk melihat profil"
          description="Favorit dan riwayat tontonan tersimpan di akunmu."
          action={
            <div className="flex gap-3">
              <Link href="/login?next=/profile" className="btn btn-primary">
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
    <div className="space-y-10 pt-4">
      <section className="panel flex flex-col gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-center gap-5">
          {authLoading ? (
            <Skeleton className="h-16 w-16 rounded-full" />
          ) : (
            <Avatar name={user?.username ?? "?"} color={user?.avatarColor} size="lg" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-fog-50">
              {user?.username}
            </h1>
            <p className="mt-1 truncate text-sm text-fog-500">{user?.email}</p>
            {user ? (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-fog-600">
                Bergabung {new Date(user.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Favorit</p>
            <p className="mt-0.5 text-lg font-bold text-fog-100">{favorites.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Riwayat</p>
            <p className="mt-0.5 text-lg font-bold text-fog-100">{history.length}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              toast("Kamu telah keluar.", "info");
              router.push("/");
            }}
            className="btn btn-danger"
          >
            Keluar
          </button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Koleksi</p>
            <h2 className="section-title mt-1.5">Favorit Saya</h2>
          </div>
        </div>

        {dataLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[2/3] w-full rounded-2xl" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada favorit"
            description="Tandai anime dengan tombol Favorit di halaman detail untuk menyimpannya di sini."
            action={
              <Link href="/explore" className="btn btn-outline">
                Jelajahi Katalog
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favorites.map((item) => (
              <div key={item.contentId} className="group relative">
                <Link href={`/anime/${item.contentId}`} className="block">
                  <div className="poster-frame aspect-[2/3] w-full overflow-hidden rounded-2xl">
                    {item.anime?.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.anime.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-ink-800 text-xs text-fog-600">
                        Tidak tersedia
                      </div>
                    )}
                  </div>
                  <p className="mt-2 truncate text-[13px] font-semibold text-fog-200">
                    {item.anime?.title ?? item.contentId}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => void removeFavorite(item.contentId)}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink-950/80 text-fog-300 opacity-0 backdrop-blur-md transition-all hover:bg-rose-500/80 hover:text-white group-hover:opacity-100"
                  aria-label="Hapus dari favorit"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Lanjutkan</p>
            <h2 className="section-title mt-1.5">Riwayat Tontonan</h2>
          </div>
          {history.length > 0 ? (
            <button
              type="button"
              onClick={() => void clearAllHistory()}
              className="text-xs font-semibold text-rose-400 transition-colors hover:text-rose-300"
            >
              Bersihkan semua
            </button>
          ) : null}
        </div>

        {dataLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada riwayat"
            description="Mulai tonton episode apa pun, progresnya akan muncul di sini."
            action={
              <Link href="/explore" className="btn btn-outline">
                Mulai Menonton
              </Link>
            }
          />
        ) : (
          <div className="panel divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
            {history.map((entry) => (
              <div key={entry.contentId} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <Link href={`/anime/${entry.contentId}`} className="poster-frame h-[68px] w-[48px] shrink-0 overflow-hidden rounded-lg">
                  {entry.anime?.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.anime.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fog-200">
                    {entry.anime?.title ?? entry.contentId}
                  </p>
                  <p className="mt-0.5 text-xs text-fog-500">
                    {entry.episodeNumber ? `Episode ${entry.episodeNumber}` : "Episode"} ·{" "}
                    {formatRelativeTime(entry.updatedAt)}
                  </p>
                  <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400"
                      style={{ width: progressWidth(entry.progressPercent) }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {entry.episodeId ? (
                    <Link
                      href={`/watch/${entry.contentId}/${entry.episodeId}`}
                      className="btn btn-primary !py-2 text-xs"
                    >
                      Lanjut Tonton
                    </Link>
                  ) : (
                    <Link href={`/anime/${entry.contentId}`} className="btn btn-outline !py-2 text-xs">
                      Detail
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeHistoryEntry(entry.contentId)}
                    className="btn btn-ghost !p-2 text-fog-500 hover:text-rose-400"
                    aria-label="Hapus riwayat"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
