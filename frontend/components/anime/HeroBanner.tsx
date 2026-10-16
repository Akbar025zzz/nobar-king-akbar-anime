import Link from "next/link";
import { kindLabel, scoreLabel } from "@/lib/format";
import type { AnimeCard } from "@/lib/types";

export function HeroBanner({ anime }: { anime: AnimeCard }) {
  const score = scoreLabel(anime.score);
  const backdrop = anime.backdropUrl ?? anime.posterUrl;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-ink-900">
      {backdrop ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backdrop} alt="" className="animate-drift h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/88 to-ink-950/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
        </div>
      ) : null}

      <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:py-16">
        <div className="animate-rise">
          <p className="section-kicker">Sedang tayang · Nobar siap dibuka</p>
          <h1 className="mt-3 max-w-2xl text-balance text-3xl font-extrabold leading-[1.07] tracking-tight text-fog-50 sm:text-4xl lg:text-[46px]">
            {anime.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {kindLabel(anime.kind) ? <span className="chip">{kindLabel(anime.kind)}</span> : null}
            {anime.year ? <span className="chip">{anime.year}</span> : null}
            {score ? <span className="chip text-amber-400">★ {score}</span> : null}
            {anime.genres.slice(0, 3).map((genre) => (
              <span key={genre} className="chip">
                {genre}
              </span>
            ))}
          </div>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-fog-400">
            Tonton sekarang atau buat room nobar, lalu ajak teman menonton dengan pemutaran yang
            tersinkron dan obrolan langsung.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={`/anime/${anime.id}`} className="btn btn-primary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
              </svg>
              Tonton Sekarang
            </Link>
            <Link href={`/nobar/create?contentId=${anime.id}`} className="btn btn-outline">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M6.5 6.5a7.8 7.8 0 0 0 0 11M17.5 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Buat Nobar
            </Link>
            <Link href="/explore" className="btn btn-ghost">
              Jelajahi katalog →
            </Link>
          </div>
        </div>

        <div className="perspective-stage group/hero relative mx-auto w-[200px] sm:w-[240px] lg:mx-0 lg:ml-auto lg:mr-6">
          <div className="absolute -inset-10 -z-10 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="poster-3d poster-3d-back absolute inset-0 overflow-hidden rounded-2xl border border-white/10">
            {anime.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={anime.posterUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="poster-3d poster-3d-main relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/15 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.95)]">
            {anime.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={anime.posterUrl} alt={anime.title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-ink-800 text-fog-700">Poster</div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-white/10" />
            <div className="absolute bottom-3 left-3 right-3">
              <span className="glass block rounded-xl px-3 py-2 text-center text-[11px] font-semibold text-fog-100">
                {anime.title.length > 30 ? `${anime.title.slice(0, 30)}…` : anime.title}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
