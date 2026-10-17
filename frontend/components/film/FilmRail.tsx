"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FilmCard as FilmCardType } from "@/lib/types";
import { FilmCard } from "./FilmCard";

/**
 * Baris katalog horizontal: digeser dengan tombol maupun swipe, tanpa scrollbar
 * yang mengganggu. Tombol muncul hanya kalau memang masih ada sisa konten.
 */
export function FilmRail({ items }: { items: FilmCardType[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const syncArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanLeft(track.scrollLeft > 8);
    setCanRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncArrows();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", syncArrows, { passive: true });
    window.addEventListener("resize", syncArrows);
    return () => {
      track.removeEventListener("scroll", syncArrows);
      window.removeEventListener("resize", syncArrows);
    };
  }, [syncArrows, items.length]);

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.round(track.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <div className="group/rail relative">
      <div
        ref={trackRef}
        className="rail-track flex gap-3 overflow-x-auto pb-1"
        style={{ scrollSnapType: "x proximity" }}
      >
        {items.map((film, index) => (
          <div
            key={film.id}
            className="w-[132px] shrink-0 sm:w-[148px] lg:w-[164px]"
            style={{ scrollSnapAlign: "start" }}
          >
            <FilmCard film={film} eager={index < 5} />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Geser ke kiri"
        onClick={() => scrollBy(-1)}
        className={`absolute -left-3 top-[38%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-900/90 text-fog-200 backdrop-blur-md transition-opacity duration-200 hover:border-accent-500/40 hover:text-accent-300 lg:grid ${
          canLeft ? "opacity-0 group-hover/rail:opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Geser ke kanan"
        onClick={() => scrollBy(1)}
        className={`absolute -right-3 top-[38%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-900/90 text-fog-200 backdrop-blur-md transition-opacity duration-200 hover:border-accent-500/40 hover:text-accent-300 lg:grid ${
          canRight ? "opacity-0 group-hover/rail:opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9.5 5.5 16 12l-6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
