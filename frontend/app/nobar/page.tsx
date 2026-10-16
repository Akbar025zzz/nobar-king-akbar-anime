import type { Metadata } from "next";
import Link from "next/link";
import { RoomCard } from "@/components/room/RoomCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiGet } from "@/lib/api";
import type { RoomDTO } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nobar — Nonton Bareng",
  description: "Room nobar live dengan pemutaran tersinkron dan obrolan langsung.",
};

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Pilih anime & episode",
    description: "Telusuri katalog atau mulai langsung dari halaman tonton.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="m10 9.5 5 2.5-5 2.5v-5Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Buat room nobar",
    description: "Beri nama room, atur publik atau privat, lalu bagikan tautannya.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.5 6.5a7.8 7.8 0 0 0 0 11M17.5 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Nonton tersinkron",
    description: "Host mengendalikan pemutaran, semua peserta mengikuti otomatis.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16 7.2a3 3 0 1 1 0 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function NobarPage() {
  const rooms = await safe(apiGet<RoomDTO[]>("/api/rooms/live", { server: true }), []);
  const publicRooms = rooms.filter((room) => room.privacy === "public");

  return (
    <div className="space-y-12 pt-4">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Nonton bareng</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fog-50 sm:text-4xl">
            Room Nobar
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fog-400">
            Gabung ke room yang sedang live atau buat sesimu sendiri. Pemutaran video tersinkron
            untuk semua peserta, lengkap dengan obrolan langsung.
          </p>
        </div>
        <Link href="/nobar/create" className="btn btn-primary shrink-0">
          + Buat Room Baru
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500/12 text-accent-400">
                {step.icon}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-fog-600">
                Langkah {index + 1}
              </span>
            </div>
            <h2 className="mt-4 text-sm font-bold text-fog-100">{step.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-fog-500">{step.description}</p>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Realtime</p>
            <h2 className="section-title mt-1.5">Sedang Live</h2>
          </div>
          <span className="chip border-rose-500/30 text-rose-400">
            <span className="live-dot" />
            {publicRooms.length} room publik
          </span>
        </div>

        {publicRooms.length === 0 ? (
          <EmptyState
            title="Belum ada room yang live"
            description="Jadilah yang pertama! Buat room nobar, lalu bagikan tautannya ke teman-temanmu."
            action={
              <Link href="/nobar/create" className="btn btn-primary">
                Buat Room Pertama
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
