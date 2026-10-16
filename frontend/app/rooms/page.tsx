"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { RoomCard } from "@/components/room/RoomCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGet, errorMessage } from "@/lib/api";
import { episodeLabel, formatRelativeTime } from "@/lib/format";
import type { RoomDTO } from "@/lib/types";

export default function MyRoomsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiGet<RoomDTO[]>("/api/rooms/mine")
      .then((data) => {
        if (active) setRooms(data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          title="Masuk untuk melihat room kamu"
          description="Riwayat room nobar terhubung dengan akunmu."
          action={
            <Link href="/login?next=/rooms" className="btn btn-primary">
              Masuk
            </Link>
          }
        />
      </div>
    );
  }

  const activeRooms = rooms.filter((room) => room.isActive);
  const pastRooms = rooms.filter((room) => !room.isActive);

  return (
    <div className="space-y-10 pt-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Akun</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fog-50">Room Saya</h1>
          <p className="mt-2 text-sm text-fog-400">Semua room nobar yang kamu buat atau ikuti.</p>
        </div>
        <Link href="/nobar/create" className="btn btn-primary shrink-0">
          + Buat Room Baru
        </Link>
      </header>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[130px] w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Gagal memuat room" description={error} />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="Belum ada room"
          description="Kamu belum pernah membuat atau bergabung ke room nobar. Mulai sekarang!"
          action={
            <Link href="/nobar/create" className="btn btn-primary">
              Buat Room Pertama
            </Link>
          }
        />
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="section-title">
              Sedang Aktif{" "}
              <span className="ml-1 font-mono text-xs text-fog-600">({activeRooms.length})</span>
            </h2>
            {activeRooms.length === 0 ? (
              <EmptyState compact title="Tidak ada room aktif" description="Room yang sudah berakhir ada di bawah." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeRooms.map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            )}
          </section>

          {pastRooms.length > 0 ? (
            <section className="space-y-4">
              <h2 className="section-title">
                Sudah Berakhir{" "}
                <span className="ml-1 font-mono text-xs text-fog-600">({pastRooms.length})</span>
              </h2>
              <div className="panel divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
                {pastRooms.map((room) => (
                  <div key={room.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] font-mono text-[10px] font-bold uppercase text-fog-500">
                      OFF
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fog-200">{room.roomName}</p>
                      <p className="mt-0.5 truncate text-xs text-fog-500">
                        {room.content.anime?.title ?? "Anime"} · {episodeLabel(room.content.episode)} ·{" "}
                        {formatRelativeTime(room.updatedAt)}
                      </p>
                    </div>
                    <Link href={`/anime/${room.content.contentId}`} className="btn btn-ghost !py-2 text-xs">
                      Detail
                    </Link>
                    <Link
                      href={`/nobar/create?contentId=${room.content.contentId}${
                        room.content.episodeId ? `&episodeId=${room.content.episodeId}` : ""
                      }`}
                      className="btn btn-outline !py-2 text-xs"
                    >
                      Nobar Lagi
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
