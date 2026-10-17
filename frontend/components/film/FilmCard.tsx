import Link from "next/link";
import { scoreLabel } from "@/lib/format";
import type { FilmCard as FilmCardType } from "@/lib/types";

const KIND_LABEL: Record<FilmCardType["kind"], string> = {
  movie: "Film",
  series: "Series",
};

export function FilmCard({ film, eager = false }: { film: FilmCardType; eager?: boolean }) {
  const meta = [KIND_LABEL[film.kind], film.year].filter(Boolean).join(" · ");
  const score = scoreLabel(film.score);

  return (
    <Link href={`/film/${film.id}`} className="group flex flex-col gap-2.5">
      <div className="poster-frame relative aspect-[2/3] w-full">
        {film.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={film.posterUrl}
            alt={film.title}
            loading={eager ? "eager" : "lazy"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-ink-800 text-fog-700">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 5v4M15 5v4" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/10 to-transparent" />

        <div className="absolute left-2 top-2">
          <span className="rounded-md bg-ink-950/75 px-1.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-fog-300 backdrop-blur-md">
            {KIND_LABEL[film.kind]}
          </span>
        </div>

        {score ? (
          <span className="absolute right-2 top-2 rounded-lg bg-ink-950/80 px-1.5 py-1 font-mono text-[10px] font-bold text-amber-400 backdrop-blur-md">
            ★ {score}
          </span>
        ) : null}

        <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-500/95 text-ink-950 shadow-[0_0_0_1px_rgba(85,203,216,0.4),0_14px_40px_-10px_rgba(85,203,216,0.8)]">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
            </svg>
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-2 bottom-2 translate-y-1.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="glass block rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold text-fog-100">
            Lihat &amp; Nobar
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-[13.5px] font-semibold leading-snug text-fog-100 transition-colors group-hover:text-accent-300">
          {film.title}
        </h3>
        <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-fog-600">
          {meta || "Film"}
        </p>
      </div>
    </Link>
  );
}
