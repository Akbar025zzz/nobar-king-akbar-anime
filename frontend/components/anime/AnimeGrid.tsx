import type { ReactNode } from "react";
import type { AnimeCard as AnimeCardType } from "@/lib/types";
import { AnimeCard } from "./AnimeCard";

interface AnimeGridProps {
  items: AnimeCardType[];
  emptyState?: ReactNode;
  eagerCount?: number;
}

export function AnimeGrid({ items, emptyState, eagerCount = 0 }: AnimeGridProps) {
  if (items.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((anime, index) => (
        <div key={`${anime.id}-${index}`} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
          <AnimeCard anime={anime} eager={index < eagerCount} />
        </div>
      ))}
    </div>
  );
}
