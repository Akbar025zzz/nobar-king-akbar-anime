import type { AnimeStatus } from "./types";

export function statusLabel(status: AnimeStatus): string | null {
  if (status === "ongoing") return "Sedang Tayang";
  if (status === "finished") return "Tamat";
  return null;
}

export function kindLabel(kind: string | null): string | null {
  if (!kind) return null;
  const map: Record<string, string> = {
    "TV Anime": "TV",
    "Película": "Film",
    "Especial": "Spesial",
    "OVA": "OVA",
    "ONA": "ONA",
  };
  return map[kind] ?? kind;
}

/** Bentuk minimal yang dibutuhkan label episode — dipakai anime maupun film. */
export interface EpisodeLabelInput {
  number: number | null;
  title: string | null;
}

export function episodeLabel(episode: EpisodeLabelInput | null | undefined): string {
  if (!episode) return "Episode";
  if (episode.number) return `Episode ${episode.number}`;
  return episode.title ?? "Episode";
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return "baru saja";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function scoreLabel(score: number | null): string | null {
  if (score === null || score <= 0) return null;
  return score.toFixed(1);
}

export function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}rb`;
  return String(count);
}

export function progressWidth(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  return `${clamped}%`;
}
