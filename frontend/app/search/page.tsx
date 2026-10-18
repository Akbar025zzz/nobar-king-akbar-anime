import type { Metadata } from "next";
import { AnimeCard as AnimeCardView } from "@/components/anime/AnimeCard";
import { FilmCard as FilmCardView } from "@/components/film/FilmCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiGet } from "@/lib/api";
import type { AnimeCard, FilmCard } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cari Anime & Film",
  description: "Cari judul anime, film, drama Korea, dan drama China dalam satu tempat.",
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function safeSearch<T>(path: string): Promise<T[]> {
  try {
    return await apiGet<T[]>(path, { server: true, revalidate: 60 });
  } catch {
    return [];
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = (await searchParams).q?.trim() ?? "";
  const encoded = encodeURIComponent(query);
  const [anime, films] = query.length >= 2
    ? await Promise.all([
        safeSearch<AnimeCard>(`/api/anime/search?q=${encoded}`),
        safeSearch<FilmCard>(`/api/film/search?q=${encoded}`),
      ])
    : [[], []];

  const total = anime.length + films.length;

  return (
    <div className="space-y-8 pt-4">
      <header className="space-y-3">
        <p className="section-kicker">Pencarian</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-fog-50 sm:text-4xl">
          {query ? `Hasil untuk “${query}”` : "Cari anime atau film"}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-fog-400">
          {query.length >= 2
            ? `${total} judul ditemukan — anime, film, series, drakor, dan dracin. Pilih judul untuk melihat detail atau mulai nobar.`
            : "Gunakan tombol pencarian di bagian atas, terutama saat membuka situs dari HP."}
        </p>
      </header>

      {query.length < 2 ? (
        <EmptyState title="Mulai mencari" description="Ketik minimal 2 karakter, misalnya naruto, one piece, atau the raid." />
      ) : total === 0 ? (
        <EmptyState title="Judul tidak ditemukan" description={`Tidak ada anime atau film yang cocok dengan “${query}”. Coba kata kunci lain.`} />
      ) : (
        <div className="space-y-10">
          {anime.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="section-kicker">Anime</p>
                  <h2 className="mt-1 text-xl font-bold text-fog-50">Hasil anime</h2>
                </div>
                <span className="chip">{anime.length} judul</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
                {anime.map((item, index) => <AnimeCardView key={item.id} anime={item} eager={index < 6} />)}
              </div>
            </section>
          ) : null}

          {films.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="section-kicker">Film &amp; Series</p>
                  <h2 className="mt-1 text-xl font-bold text-fog-50">Hasil film</h2>
                </div>
                <span className="chip">{films.length} judul</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
                {films.map((item, index) => <FilmCardView key={item.id} film={item} eager={index < 6} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
