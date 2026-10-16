import Link from "next/link";
import type { GenreOption } from "@/lib/types";

export function GenreChips({
  genres,
  active,
  basePath = "/explore",
}: {
  genres: GenreOption[];
  active?: string;
  basePath?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={basePath} className={`chip ${!active ? "chip-active" : ""}`}>
        Semua
      </Link>
      {genres.map((genre) => (
        <Link
          key={genre.slug}
          href={`${basePath}?genre=${genre.slug}`}
          className={`chip ${active === genre.slug ? "chip-active" : ""}`}
        >
          {genre.name}
        </Link>
      ))}
    </div>
  );
}
