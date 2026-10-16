"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { RoomParticipantInfo } from "@/lib/types";

export function RoomParticipants({ participants }: { participants: RoomParticipantInfo[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      {participants.map((participant) => (
        <div
          key={participant.userId}
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3"
          title={participant.isHost ? `${participant.username} (Host)` : participant.username}
        >
          <Avatar name={participant.username} color={participant.avatarColor} size="sm" />
          <span className="max-w-[96px] truncate text-[11px] font-semibold text-fog-300">
            {participant.username}
          </span>
          {participant.isHost ? (
            <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
              Host
            </span>
          ) : null}
        </div>
      ))}
      {participants.length === 0 ? (
        <span className="text-xs text-fog-600">Belum ada peserta lain.</span>
      ) : null}
    </div>
  );
}
