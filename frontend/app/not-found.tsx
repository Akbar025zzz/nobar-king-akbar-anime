import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center pt-16 text-center">
      <div className="panel w-full rounded-3xl px-8 py-12">
        <p className="font-mono text-5xl font-extrabold tracking-tight text-accent-400">404</p>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-fog-50">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fog-500">
          Tautan yang kamu buka mungkin salah atau kontennya sudah tidak tersedia di sumber.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Ke Beranda
          </Link>
          <Link href="/explore" className="btn btn-outline">
            Jelajahi Katalog
          </Link>
        </div>
      </div>
    </div>
  );
}
