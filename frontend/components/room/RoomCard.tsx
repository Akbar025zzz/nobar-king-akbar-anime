import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { episodeLabel, formatRelativeTime } from "@/lib/format";
import type { RoomDTO } from "@/lib/types";

export function RoomCard({ room, compact = false }: { room: RoomDTO; compact?: boolean }) {
  const anime = room.content.anime;
  const poster = anime?.posterUrl ?? null;

  return (
    <Link
      href={`/nobar/room/${room.id}`}
      className={`group panel relative flex overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-500/35 ${
        compact ? "gap-3 p-2.5" : "gap-4 p-3"
      }`}
    >
      <div
        className={`poster-frame shrink-0 overflow-hidden rounded-xl ${
          compact ? "h-[74px] w-[52px]" : "h-[104px] w-[72px]"
        }`}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-ink-800 text-fog-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300">
            <span className="live-dot !h-1.5 !w-1.5" />
            Live
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-fog-600">
            {formatRelativeTime(room.updatedAt)}
          </span>
        </div>

        <h3 className="mt-1.5 truncate text-sm font-bold text-fog-100 transition-colors group-hover:text-accent-300">
          {room.roomName}
        </h3>
        <p className="mt-0.5 truncate text-xs text-fog-400">
          {anime?.title ?? "Anime"}
          <span className="text-fog-600"> · {episodeLabel(room.content.episode)}</span>
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Avatar name={room.host.username} color={room.host.avatarColor} size="sm" />
          <span className="truncate text-[11px] font-semibold text-fog-300">{room.host.username}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-fog-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M16 7.2a3 3 0 1 1 0 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {room.participantCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
