"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center pt-16 text-center">
      <div className="panel w-full rounded-3xl px-8 py-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/15 text-rose-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-5 text-xl font-extrabold tracking-tight text-fog-50">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm leading-relaxed text-fog-500">
          Ada yang tidak berjalan semestinya saat memuat halaman ini. Coba muat ulang, atau kembali
          ke beranda.
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-fog-700">
            Kode: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Coba Lagi
          </button>
          <Link href="/" className="btn btn-outline">
            Ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
