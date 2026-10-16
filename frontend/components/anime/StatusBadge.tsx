import { statusLabel } from "@/lib/format";
import type { AnimeStatus } from "@/lib/types";

export function StatusBadge({ status, className = "" }: { status: AnimeStatus; className?: string }) {
  const label = statusLabel(status);
  if (!label) return null;
  const ongoing = status === "ongoing";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
        ongoing ? "bg-rose-500/25 text-rose-300" : "bg-ink-950/75 text-fog-300"
      } ${className}`}
    >
      {ongoing ? <span className="live-dot !h-1.5 !w-1.5" /> : null}
      {label}
    </span>
  );
}
