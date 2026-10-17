import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmDetailClient } from "@/components/film/FilmDetailClient";
import { apiGet, decodeRouteParam, errorMessage } from "@/lib/api";
import type { FilmDetail } from "@/lib/types";

export const revalidate = 600;

async function loadFilm(rawId: string, season?: string): Promise<FilmDetail | null> {
  const id = decodeRouteParam(rawId);
  const query = season ? `?season=${encodeURIComponent(season)}` : "";
  try {
    return await apiGet<FilmDetail>(`/api/film/${encodeURIComponent(id)}${query}`, {
      server: true,
      revalidate: 600,
    });
  } catch (error) {
    const message = errorMessage(error);
    if (message.toLowerCase().includes("tidak ditemukan")) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const film = await loadFilm(params.id).catch(() => null);
  if (!film) return { title: "Film tidak ditemukan" };
  return {
    title: film.title,
    description: film.overview?.slice(0, 160) ?? undefined,
    openGraph: {
      title: film.title,
      description: film.overview?.slice(0, 200) ?? undefined,
      images: film.backdropUrl ? [film.backdropUrl] : undefined,
    },
  };
}

export default async function FilmDetailPage({ params }: { params: { id: string } }) {
  const film = await loadFilm(params.id);
  if (!film) notFound();

  const meta = [
    film.kind === "series" ? "Series" : "Film",
    film.year,
    film.kind === "series" && film.totalEpisodes ? `${film.totalEpisodes} episode` : null,
    film.runtimeMinutes ? `${film.runtimeMinutes} menit` : null,
    film.status,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-12 pt-2">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07]">
        {film.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={film.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/88 to-ink-950/50" />

        <div className="relative flex flex-col gap-7 px-6 py-9 sm:px-9 sm:py-12 lg:flex-row lg:gap-10">
          <div className="poster-frame mx-auto h-[270px] w-[180px] shrink-0 lg:mx-0 lg:h-[300px] lg:w-[200px]">
            {film.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={film.posterUrl} alt={film.title} className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <nav className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fog-600">
              <Link href="/film" className="transition-colors hover:text-accent-300">
                Film
              </Link>
              <span>/</span>
              <span className="truncate text-fog-500">{film.title}</span>
            </nav>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-fog-50 sm:text-4xl">
              {film.title}
            </h1>
            {film.tagline ? <p className="mt-2 text-sm italic text-accent-300/90">{film.tagline}</p> : null}

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-fog-500">
              {meta.map((entry) => (
                <span key={entry}>{entry}</span>
              ))}
              {film.score ? <span className="text-amber-400">★ {film.score}/10</span> : null}
            </p>

            {film.genres.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {film.genres.map((genre) => (
                  <span key={genre} className="chip">
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            {film.overview ? (
              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-fog-300">{film.overview}</p>
            ) : null}

            <FilmDetailClient film={film} />
          </div>
        </div>
      </section>

      {film.cast.length > 0 ? (
        <section className="space-y-4">
          <div>
            <p className="section-kicker">Pemain</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-fog-50">Bintang utama</h2>
          </div>
          <div className="rail-track flex gap-4 overflow-x-auto pb-1">
            {film.cast.map((member) => (
              <div key={member.id} className="w-[112px] shrink-0 text-center">
                <div className="poster-frame mx-auto h-[112px] w-[112px] rounded-full">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photoUrl} alt={member.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-ink-800 font-mono text-lg text-fog-600">
                      {member.name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 truncate text-[12.5px] font-semibold text-fog-100">{member.name}</p>
                {member.character ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-fog-600">
                    {member.character}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="pb-4 text-center font-mono text-[10px] uppercase tracking-wider text-fog-700">
        Metadata dari TMDb · pemutaran oleh penyedia mitra
      </p>
    </div>
  );
}
