import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchClient } from "@/components/watch/WatchClient";
import { apiGet, decodeRouteParam } from "@/lib/api";
import type { AnimeDetail, FilmDetail } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string; episodeId: string }>;
}

async function getDetail(id: string): Promise<AnimeDetail | FilmDetail | null> {
  const isFilm = id.startsWith("tmdb:");
  const path = isFilm
    ? `/api/film/${encodeURIComponent(id)}`
    : `/api/anime/${encodeURIComponent(id)}`;
  try {
    return await apiGet<AnimeDetail | FilmDetail>(path, { server: true, revalidate: 600 });
  } catch (error) {
    console.error("[watch] getDetail failed", { id, error: String(error) });
    return null;
  }
}

function episodeTitle(detail: AnimeDetail | FilmDetail, episodeId: string): string {
  if (detail.id.startsWith("tmdb:")) {
    const film = detail as FilmDetail;
    if (film.kind === "movie") return film.title;
    const episode = film.episodes.find((item) => item.id === episodeId);
    return episode ? `Episode ${episode.number}` : "Episode";
  }
  const anime = detail as AnimeDetail;
  const episode = anime.episodes.find((item) => item.id === episodeId);
  return episode?.title ?? `Episode ${episode?.number ?? ""}`.trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = decodeRouteParam((await params).id);
  const episodeId = decodeRouteParam((await params).episodeId);
  const detail = await getDetail(id);
  if (!detail) return { title: "Tonton" };
  const isFilm = id.startsWith("tmdb:");
  return {
    title: `${detail.title} — ${episodeTitle(detail, episodeId)}`,
    description: isFilm
      ? `Tonton ${detail.title} di Nobar King Akbar Anime.`
      : `Tonton ${detail.title} subtitle Indonesia.`,
  };
}

export default async function WatchPage({ params }: PageProps) {
  const id = decodeRouteParam((await params).id);
  const episodeId = decodeRouteParam((await params).episodeId);
  const detail = await getDetail(id);

  if (!detail) {
    notFound();
  }

  return <WatchClient detail={detail} episodeId={episodeId} />;
}
