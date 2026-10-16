"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { apiGet } from "@/lib/api";
import type { AnimeCard } from "@/lib/types";

const NAV_LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/explore", label: "Jelajah" },
  { href: "/nobar", label: "Nobar" },
];

function LogoMark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-b from-accent-400 to-accent-700 shadow-[0_10px_26px_-12px_rgba(85,203,216,0.9)]">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 3.2v9.6c0 .8.9 1.3 1.6.9l7-4.8c.6-.4.6-1.4 0-1.8l-7-4.8c-.7-.4-1.6.1-1.6.9Z" fill="#062126" />
      </svg>
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await apiGet<{ rooms: number }>("/api/meta/live-count");
        if (active) setLiveCount(data.rooms);
      } catch {
        /* keep previous value */
      }
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const items = await apiGet<AnimeCard[]>(`/api/anime/search?q=${encodeURIComponent(trimmed)}`);
        setResults(items.slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setResults([]);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setResults([]);
  }, [pathname]);

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setResults([]);
    router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-[15px] font-bold tracking-tight text-fog-50">Nobar King Akbar</span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-accent-400">Anime</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/[0.06] text-fog-50" : "text-fog-400 hover:bg-white/[0.04] hover:text-fog-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <span className="chip ml-1 border-rose-500/30 text-rose-400">
            <span className="live-dot" />
            {liveCount === null ? "…" : `${liveCount} live`}
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div ref={searchRef} className="relative hidden w-[min(38vw,340px)] lg:block">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
                if (event.key === "Escape") setResults([]);
              }}
              placeholder="Cari anime…"
              aria-label="Cari anime"
              className="input !py-2.5 pl-9 text-sm"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-600"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {searching ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size={14} />
              </span>
            ) : null}

            {results.length > 0 ? (
              <div className="panel absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)]">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    href={`/anime/${item.id}`}
                    onClick={() => setResults([])}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.05]"
                  >
                    <span className="poster-frame h-12 w-9 shrink-0 rounded-lg">
                      {item.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fog-100">{item.title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-fog-600">
                        {[item.kind, item.year].filter(Boolean).join(" · ") || "Anime"}
                      </span>
                    </span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={submitSearch}
                  className="mt-1 w-full rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-accent-400 transition-colors hover:bg-white/[0.05]"
                >
                  Lihat semua hasil untuk “{query.trim()}”
                </button>
              </div>
            ) : null}
          </div>

          <Link
            href="/nobar"
            className="btn btn-primary hidden !py-2.5 text-[13px] md:inline-flex"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 4.5v15l13-7.5-13-7.5Z" fill="currentColor" />
            </svg>
            Mulai Nobar
          </Link>

          {loading ? (
            <span className="skeleton h-9 w-9 rounded-full" />
          ) : user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition-colors hover:border-accent-500/40"
                aria-label="Menu akun"
              >
                <Avatar name={user.username} color={user.avatarColor} size="sm" />
                <span className="hidden max-w-[110px] truncate text-xs font-semibold text-fog-200 sm:block">
                  {user.username}
                </span>
              </button>
              {menuOpen ? (
                <div className="panel absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl p-1.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)]">
                  <Link
                    href="/profile"
                    className="block rounded-xl px-3 py-2 text-sm text-fog-200 transition-colors hover:bg-white/[0.06]"
                  >
                    Profil Saya
                  </Link>
                  <Link
                    href="/rooms"
                    className="block rounded-xl px-3 py-2 text-sm text-fog-200 transition-colors hover:bg-white/[0.06]"
                  >
                    Room Saya
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      setMenuOpen(false);
                      router.push("/");
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-400 transition-colors hover:bg-rose-500/10"
                  >
                    Keluar
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-ghost !py-2.5 text-[13px]">
                Masuk
              </Link>
              <Link href="/register" className="btn btn-outline !py-2.5 text-[13px]">
                Daftar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
