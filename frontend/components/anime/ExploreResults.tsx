"use client";

import { useCallback, useState } from "react";
import { AnimeGrid } from "@/components/anime/AnimeGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { apiGetWithMeta, errorMessage } from "@/lib/api";
import type { AnimeCard } from "@/lib/types";

interface ExploreResultsProps {
  initialItems: AnimeCard[];
  initialPage: number;
  initialHasNext: boolean;
  query: string | null;
  genre: string | null;
  status: string | null;
  emptyTitle: string;
}

function buildUrl(query: string | null, genre: string | null, status: string | null, page: number): string {
  if (query) return `/api/anime/search?q=${encodeURIComponent(query)}`;
  if (status === "ongoing") return `/api/anime/ongoing?page=${page}`;
  if (status === "finished") return `/api/anime/complete?page=${page}`;
  const params = new URLSearchParams({ page: String(page) });
  if (genre) params.set("genre", genre);
  return `/api/anime?${params.toString()}`;
}

export function ExploreResults({
  initialItems,
  initialPage,
  initialHasNext,
  query,
  genre,
  status,
  emptyTitle,
}: ExploreResultsProps) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await apiGetWithMeta<AnimeCard[]>(buildUrl(query, genre, status, nextPage));
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...result.data.filter((item) => !seen.has(item.id))];
      });
      setPage(nextPage);
      setHasNext(Boolean(result.meta?.hasNextPage));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query, genre, status]);

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={
          query
            ? `Tidak ada hasil untuk “${query}”. Coba kata kunci lain.`
            : "Coba pilih genre atau status lain."
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <AnimeGrid items={items} eagerCount={8} />

      {error ? <p className="text-center text-xs text-rose-400">{error}</p> : null}

      {hasNext && !query ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => void loadMore()} disabled={loading} className="btn btn-outline">
            {loading ? (
              <>
                <Spinner size={14} /> Memuat…
              </>
            ) : (
              "Muat lebih banyak"
            )}
          </button>
        </div>
      ) : null}

      {!hasNext && items.length > 12 ? (
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-fog-700">
          — akhir daftar —
        </p>
      ) : null}
    </div>
  );
}
