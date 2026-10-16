import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/anime/FavoriteButton";
import { StatusBadge } from "@/components/anime/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiGet, decodeRouteParam } from "@/lib/api";
import { kindLabel, scoreLabel } from "@/lib/format";
import type { AnimeDetail } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getDetail(id: string): Promise<AnimeDetail | null> {
  try {
    return await apiGet<AnimeDetail>(`/api/anime/${encodeURIComponent(id)}`, {
      server: true,
      revalidate: 600,
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = decodeRouteParam((await params).id);
  const detail = await getDetail(id);
  if (!detail) return { title: "Anime tidak ditemukan" };
  return {
    title: detail.title,
    description: detail.description?.slice(0, 160) ?? undefined,
    openGraph: {
      title: detail.title,
      images: detail.posterUrl ? [detail.posterUrl] : undefined,
    },
  };
}

export default async function AnimeDetailPage({ params }: PageProps) {
  const id = decodeRouteParam((await params).id);
  const detail = await getDetail(id);

  if (!detail) {
    notFound();
  }

  const firstEpisode = detail.episodes[0] ?? null;
  const score = scoreLabel(detail.score);
  const episodeCount = detail.episodes.length;

  return (
    <div className="space-y-10 pt-4">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-ink-900">
        {detail.posterUrl ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.backdropUrl ?? detail.posterUrl}
              alt=""
              className="h-full w-full scale-110 object-cover opacity-25 blur-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-ink-950/40" />
          </div>
        ) : null}

        <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:gap-10 lg:p-10">
          <div className="mx-auto w-[190px] shrink-0 sm:w-[220px] lg:mx-0">
            <div className="poster-frame aspect-[2/3] w-full overflow-hidden rounded-2xl shadow-[0_30px_60px_-25px_rgba(0,0,0,0.95)]">
              {detail.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.posterUrl} alt={detail.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-ink-800 text-fog-700">Tanpa poster</div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              {kindLabel(detail.kind) ? <span className="chip">{kindLabel(detail.kind)}</span> : null}
              {detail.year ? <span className="chip">{detail.year}</span> : null}
              {score ? <span className="chip text-amber-400">★ {score}</span> : null}
              {detail.totalEpisodes ? <span className="chip">{detail.totalEpisodes} episode</span> : null}
            </div>

            <h1 className="mt-4 text-balance text-3xl font-extrabold leading-tight tracking-tight text-fog-50 sm:text-4xl">
              {detail.title}
            </h1>
            {detail.titleJapanese ? (
              <p className="mt-2 text-sm text-fog-500">{detail.titleJapanese}</p>
            ) : null}

            {detail.genres.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/explore?q=${encodeURIComponent(genre)}`}
                    className="chip hover:border-accent-500/50"
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            ) : null}

            {detail.description ? (
              <p className="prose-synopsis mt-5 max-w-3xl">{detail.description}</p>
            ) : (
              <p className="mt-5 text-sm italic text-fog-600">Sinopsis belum tersedia dari sumber.</p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {firstEpisode ? (
                <Link href={`/watch/${detail.id}/${firstEpisode.id}`} className="btn btn-primary">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
                  </svg>
                  Tonton Episode 1
                </Link>
              ) : null}
              <Link
                href={`/nobar/create?contentId=${detail.id}${firstEpisode ? `&episodeId=${firstEpisode.id}` : ""}`}
                className="btn btn-outline"
              >
                Buat Nobar
              </Link>
              <FavoriteButton contentId={detail.id} contentUrl={detail.sourceUrl} />
              {detail.sourceUrl ? (
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost text-xs"
                >
                  Sumber ↗
                </a>
              ) : null}
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Total Episode</dt>
                <dd className="mt-1 text-lg font-bold text-fog-100">{episodeCount || "—"}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Mulai Tayang</dt>
                <dd className="mt-1 text-sm font-semibold text-fog-200">{detail.startDate ?? "—"}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Selesai</dt>
                <dd className="mt-1 text-sm font-semibold text-fog-200">{detail.endDate ?? "—"}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-fog-600">Skor Sumber</dt>
                <dd className="mt-1 text-sm font-semibold text-fog-200">{score ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Daftar tontonan</p>
            <h2 className="section-title mt-1.5">
              Episode {episodeCount > 0 ? `(${episodeCount})` : ""}
            </h2>
          </div>
        </div>

        {episodeCount === 0 ? (
          <EmptyState
            compact
            title="Belum ada episode"
            description="Sumber belum menyediakan daftar episode untuk judul ini."
          />
        ) : (
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {detail.episodes.map((episode, index) => (
              <Link
                key={episode.id}
                href={`/watch/${detail.id}/${episode.id}`}
                className="group flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-500/50 hover:bg-accent-500/10"
                title={episode.title ?? `Episode ${episode.number ?? index + 1}`}
              >
                <span className="font-mono text-sm font-bold text-fog-200 group-hover:text-accent-300">
                  {episode.number ?? index + 1}
                </span>
                <span className="mt-0.5 font-mono text-[8px] uppercase tracking-widest text-fog-600">
                  Episode
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
