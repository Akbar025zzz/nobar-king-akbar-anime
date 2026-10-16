import Link from "next/link";
import type { Metadata } from "next";
import { ExploreResults } from "@/components/anime/ExploreResults";
import { GenreChips } from "@/components/anime/GenreChips";
import { apiGet, apiGetWithMeta } from "@/lib/api";
import type { AnimeCard, GenreOption } from "@/lib/types";

export const metadata: Metadata = {
  title: "Jelajahi Katalog",
  description: "Telusuri katalog anime: sedang tayang, sudah tamat, atau berdasarkan genre.",
};

interface ExplorePageProps {
  searchParams: Promise<{ q?: string; genre?: string; status?: string; page?: string }>;
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const query = params.q?.trim() || null;
  const genre = params.genre?.trim() || null;
  const status = params.status === "ongoing" || params.status === "finished" ? params.status : null;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const url = query
    ? `/api/anime/search?q=${encodeURIComponent(query)}`
    : status === "ongoing"
      ? `/api/anime/ongoing?page=${page}`
      : status === "finished"
        ? `/api/anime/complete?page=${page}`
        : `/api/anime?page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`;

  const [results, genres] = await Promise.all([
    safe(apiGetWithMeta<AnimeCard[]>(url, { server: true }), { data: [], meta: null }),
    safe(apiGet<GenreOption[]>("/api/anime/genres", { server: true, revalidate: 3600 }), []),
  ]);

  const statusTabs = [
    { key: null, label: "Semua", href: genre ? `/explore?genre=${genre}` : "/explore" },
    { key: "ongoing", label: "Sedang Tayang", href: `/explore?status=ongoing` },
    { key: "finished", label: "Tamat", href: `/explore?status=finished` },
  ];

  const activeGenre = genres.find((item) => item.slug === genre)?.name;

  return (
    <div className="space-y-8 pt-4">
      <header className="space-y-3">
        <p className="section-kicker">Katalog</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-fog-50 sm:text-4xl">
          {query ? `Hasil untuk “${query}”` : activeGenre ? `Genre ${activeGenre}` : "Jelajahi Anime"}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-fog-400">
          {query
            ? `${results.data.length} judul ditemukan dari pencarian langsung ke sumber sub Indo.`
            : "Telusuri katalog lengkap, filter berdasarkan genre atau status penayangan, lalu mulai tonton atau buat sesi nobar."}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map((tab) => {
          const active = status === tab.key;
          return (
            <Link key={tab.label} href={tab.href} className={`chip ${active ? "chip-active" : ""}`}>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {!query ? <GenreChips genres={genres} active={genre ?? undefined} /> : null}

      <ExploreResults
        initialItems={results.data}
        initialPage={page}
        initialHasNext={Boolean(results.meta?.hasNextPage)}
        query={query}
        genre={genre}
        status={status}
        emptyTitle={query ? "Tidak ada hasil" : "Belum ada judul di sini"}
      />
    </div>
  );
}
