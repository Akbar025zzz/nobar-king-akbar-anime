import Link from "next/link";
import { FilmRail } from "@/components/film/FilmRail";
import { SectionHeader } from "@/components/anime/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiGet } from "@/lib/api";
import type { FilmRow } from "@/lib/types";

export const revalidate = 600;

export const metadata = {
  title: "Film & Series",
  description:
    "Katalog film Indonesia, film populer, drama Korea, dan drama China — tonton sendiri atau jadikan sesi nobar.",
};

export default async function FilmPage() {
  let rows: FilmRow[] = [];
  try {
    rows = await apiGet<FilmRow[]>("/api/film/rows", { server: true, revalidate: 600 });
  } catch {
    rows = [];
  }

  const featured = rows.find((row) => row.key === "film-populer")?.items[0] ?? rows[0]?.items[0] ?? null;

  if (!featured) {
    return (
      <div className="pt-6">
        <EmptyState
          title="Katalog film belum bisa dimuat"
          description="Sumber metadata film (TMDb) tidak merespons dari server ini. Coba muat ulang sebentar lagi."
        />
      </div>
    );
  }

  return (
    <div className="space-y-12 pt-2">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07]">
        {featured.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={featured.backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-ink-950/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/60 to-transparent" />

        <div className="relative flex flex-col gap-6 px-6 py-10 sm:px-9 sm:py-14 lg:flex-row lg:items-end lg:gap-8">
          <div className="poster-frame hidden h-[240px] w-[160px] shrink-0 lg:block">
            {featured.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.posterUrl} alt={featured.title} className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="max-w-2xl">
            <p className="section-kicker">Sedang populer</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fog-50 sm:text-4xl lg:text-[42px]">
              {featured.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-fog-500">
              <span>{featured.kind === "series" ? "Series" : "Film"}</span>
              {featured.year ? <span>{featured.year}</span> : null}
              {featured.score ? <span className="text-amber-400">★ {featured.score}</span> : null}
              {featured.genres.slice(0, 2).map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </p>
            {featured.overview ? (
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-fog-300">{featured.overview}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/film/${featured.id}`} className="btn btn-primary">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
                </svg>
                Lihat &amp; Tonton
              </Link>
              <Link href="/nobar/create" className="btn btn-outline">
                Buat Room Nobar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {rows.map((row) => (
        <section key={row.key} className="space-y-4">
          <SectionHeader
            kicker="Katalog film"
            title={row.title}
            description={
              row.key === "film-indonesia"
                ? "Film layar lebar Indonesia, dari klasik sampai rilisan terbaru."
                : row.key === "film-populer"
                  ? "Judul paling banyak ditonton pekan ini."
                  : row.key === "drakor"
                    ? "Drama Korea pilihan dengan sub Indo."
                    : "Drama China populer lengkap dengan sub Indo."
            }
          />
          <FilmRail items={row.items} />
        </section>
      ))}

      <section className="panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="section-kicker">Nobar film</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-fog-50">
              Tonton bareng dengan hitung mundur
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fog-400">
              Room film memakai mode sinema: host memilih judul, season, dan episode, lalu semua peserta
              mulai bersama lewat hitung mundur — obrolan tetap berjalan realtime di samping player.
              Kontrol pemutar berada di player mitra, jadi tidak diklaim tersinkron otomatis.
            </p>
          </div>
          <Link href="/nobar" className="btn btn-outline shrink-0">
            Lihat Room Live
          </Link>
        </div>
      </section>

      <p className="pb-4 text-center font-mono text-[10px] uppercase tracking-wider text-fog-700">
        Metadata film &amp; series dari TMDb · pemutaran oleh penyedia mitra
      </p>
    </div>
  );
}
