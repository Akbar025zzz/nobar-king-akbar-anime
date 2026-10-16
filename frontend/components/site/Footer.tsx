import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/[0.06] bg-ink-900/40">
      <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-b from-accent-400 to-accent-700">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 3.2v9.6c0 .8.9 1.3 1.6.9l7-4.8c.6-.4.6-1.4 0-1.8l-7-4.8c-.7-.4-1.6.1-1.6.9Z" fill="#062126" />
              </svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight text-fog-50">Nobar King Akbar</span>
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-accent-400">Anime</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-fog-500">
            Streaming anime dan nonton bareng online. Buat room, sinkronkan pemutaran, dan ngobrol
            bareng teman dalam satu layar.
          </p>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-600">Jelajahi</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-fog-400">
            <li><Link className="transition-colors hover:text-accent-400" href="/">Beranda</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/explore">Semua Anime</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/explore?status=ongoing">Sedang Tayang</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/explore?status=finished">Sudah Tamat</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-600">Nobar</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-fog-400">
            <li><Link className="transition-colors hover:text-accent-400" href="/nobar">Room Live</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/rooms">Room Saya</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/nobar/create">Buat Room</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-600">Akun</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-fog-400">
            <li><Link className="transition-colors hover:text-accent-400" href="/login">Masuk</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/register">Daftar</Link></li>
            <li><Link className="transition-colors hover:text-accent-400" href="/profile">Profil & Favorit</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-fog-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <p>© {new Date().getFullYear()} Nobar King Akbar Anime. Dibuat untuk komunitas nobar.</p>
          <p>
            Sumber data & konten: otakudesu (sub Indo) · Situs ini tidak menyimpan berkas video di servernya.
          </p>
        </div>
      </div>
    </footer>
  );
}
