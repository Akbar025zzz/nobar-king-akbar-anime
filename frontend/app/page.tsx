import Link from "next/link";
import { AnimeGrid } from "@/components/anime/AnimeGrid";
import { GenreChips } from "@/components/anime/GenreChips";
import { HeroBanner } from "@/components/anime/HeroBanner";
import { SectionHeader } from "@/components/anime/SectionHeader";
import { FilmRail } from "@/components/film/FilmRail";
import { RoomCard } from "@/components/room/RoomCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiGet, apiGetWithMeta } from "@/lib/api";
import type { AnimeCard, FilmRow, GenreOption, RoomDTO, TrendingEntry } from "@/lib/types";

export const revalidate = 120;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [ongoing, catalog, trending, genres, liveRooms, filmRows] = await Promise.all([
    safe(apiGetWithMeta<AnimeCard[]>("/api/anime/ongoing", { server: true, revalidate: 120 }), {
      data: [],
      meta: null,
    }),
    safe(apiGetWithMeta<AnimeCard[]>("/api/anime?page=1", { server: true, revalidate: 300 }), {
      data: [],
      meta: null,
    }),
    safe(apiGet<TrendingEntry[]>("/api/anime/trending", { server: true, revalidate: 30 }), []),
    safe(apiGet<GenreOption[]>("/api/anime/genres", { server: true, revalidate: 3600 }), []),
    safe(apiGet<RoomDTO[]>("/api/rooms/live", { server: true }), []),
    safe(apiGet<FilmRow[]>("/api/film/rows", { server: true, revalidate: 600 }), []),
  ]);

  const featured = ongoing.data[0] ?? catalog.data[0] ?? null;

  return (
    <div className="space-y-14 pt-4">
      {featured ? (
        <HeroBanner anime={featured} />
      ) : (
        <EmptyState
          title="Katalog sedang tidak bisa dimuat"
          description="Sumber konten tidak merespons. Coba muat ulang halaman beberapa saat lagi."
        />
      )}

      {liveRooms.length > 0 ? (
        <section className="space-y-4">
          <SectionHeader
            kicker="Realtime"
            title="Nobar sedang berlangsung"
            description="Masuk ke room dan langsung ikut menonton bareng."
            href="/nobar"
            linkLabel="Semua room"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveRooms.slice(0, 6).map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          kicker="Update terbaru"
          title="Sedang Tayang"
          description="Episode baru tiap pekan dari sumber sub Indo."
          href="/explore?status=ongoing"
        />
        <AnimeGrid
          items={ongoing.data.slice(0, 12)}
          eagerCount={6}
          emptyState={<EmptyState compact title="Tidak ada data sedang tayang" />}
        />
      </section>

      {filmRows.length > 0 ? (
        <section className="space-y-6">
          <SectionHeader
            kicker="Layar lebar"
            title="Film & Series"
            description="Film Indonesia, judul populer, drakor, dan dracin — siap ditonton atau dijadikan sesi nobar."
            href="/film"
            linkLabel="Semua film"
          />
          {filmRows.slice(0, 2).map((row) => (
            <div key={row.key} className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600">{row.title}</p>
              <FilmRail items={row.items} />
            </div>
          ))}
        </section>
      ) : null}

      {trending.length > 0 ? (
        <section className="space-y-4">
          <SectionHeader
            kicker="Statistik internal"
            title="Populer di Nobar King"
            description="Peringkat berdasarkan aktivitas room dan penonton di platform ini."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trending.slice(0, 6).map((entry) => (
              <Link
                key={entry.anime.id}
                href={`/anime/${entry.anime.id}`}
                className="group panel flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-500/35"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-500/12 font-mono text-sm font-bold text-accent-400">
                  #{entry.rank}
                </span>
                <div className="poster-frame h-[64px] w-[46px] shrink-0 overflow-hidden rounded-lg">
                  {entry.anime.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.anime.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fog-100 group-hover:text-accent-300">
                    {entry.anime.title}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fog-600">
                    {entry.watchers} penonton · {entry.rooms} room
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          kicker="Sudah tamat"
          title="Tonton Maraton"
          description="Judul lengkap yang sudah tamat — semua episodenya bisa langsung ditonton."
          href="/explore"
        />
        <AnimeGrid
          items={catalog.data.slice(0, 12)}
          emptyState={<EmptyState compact title="Katalog kosong" />}
        />
      </section>

      {genres.length > 0 ? (
        <section className="panel space-y-5 rounded-3xl p-6 sm:p-8">
          <SectionHeader
            kicker="Telusuri"
            title="Jelajahi Genre"
            description="Temukan tontonan sesuai selera, lalu jadikan sesi nobar."
            href="/explore"
          />
          <GenreChips genres={genres} />
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-ink-900 via-ink-850 to-ink-900 px-6 py-10 sm:px-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="section-kicker">Nonton bareng</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-fog-50 sm:text-3xl">
              Satu room, satu cerita, satu waktu.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fog-400">
              Buat room nobar dalam hitungan detik. Pemutaran tersinkron untuk semua peserta,
              obrolan langsung di samping video, dan kendali penuh di tangan host.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/nobar/create" className="btn btn-primary">
              Buat Room Nobar
            </Link>
            <Link href="/nobar" className="btn btn-outline">
              Lihat Room Live
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
