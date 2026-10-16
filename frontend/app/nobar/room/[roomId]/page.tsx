import type { Metadata } from "next";
import { RoomClient } from "@/components/room/RoomClient";

export const metadata: Metadata = {
  title: "Room Nobar",
  description: "Nonton bareng dengan pemutaran tersinkron dan obrolan langsung.",
};

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { roomId } = await params;
  return <RoomClient roomId={roomId} />;
}
