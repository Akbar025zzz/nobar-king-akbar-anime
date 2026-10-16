import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchClient } from "@/components/watch/WatchClient";
import { apiGet, decodeRouteParam } from "@/lib/api";
import type { AnimeDetail } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string; episodeId: string }>;
}

async function getDetail(id: string): Promise<AnimeDetail | null> {
  try {
    return await apiGet<AnimeDetail>(`/api/anime/${encodeURIComponent(id)}`, {
      server: true,
      revalidate: 600,
    });
  } catch (error) {
    console.error("[watch] getDetail failed", { id, error: String(error) });
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = decodeRouteParam((await params).id);
  const episodeId = decodeRouteParam((await params).episodeId);
  const detail = await getDetail(id);
  if (!detail) return { title: "Tonton Anime" };
  const episode = detail.episodes.find((item) => item.id === episodeId);
  return {
    title: `${detail.title} — ${episode?.title ?? `Episode ${episode?.number ?? ""}`}`.trim(),
    description: `Tonton ${detail.title} subtitle Indonesia.`,
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
