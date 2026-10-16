import type { Metadata } from "next";
import { CreateRoomClient } from "@/components/room/CreateRoomClient";

export const metadata: Metadata = {
  title: "Buat Room Nobar",
  description: "Buat room nobar: pilih anime, episode, dan atur privasi room.",
};

interface PageProps {
  searchParams: Promise<{ contentId?: string; episodeId?: string }>;
}

export default async function CreateRoomPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <CreateRoomClient
      initialContentId={params.contentId?.trim() || null}
      initialEpisodeId={params.episodeId?.trim() || null}
    />
  );
}
