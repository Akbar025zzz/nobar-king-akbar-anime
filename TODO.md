# TODO — Nobar King Akbar Anime

## 1. Aplikasi sumber terpasang sebagai website WebDev

**Status: selesai**

- Root proyek berisi aplikasi dari arsip unggahan, dengan `frontend/` Next.js, `backend/` Express + Socket.IO, `wajik-anime-api/`, `anime1v-api/`, konfigurasi gateway, skrip, dokumentasi, dan aset.
- File rahasia lokal tidak dibawa ke source checkpoint.
- Struktur aplikasi sumber dipertahankan agar fitur yang telah tervalidasi tidak dibuat ulang atau dipangkas.

## 2. Beranda dan katalog anime sub Indo

**Status: menunggu verifikasi Preview**

- Situs menampilkan beranda berbahasa Indonesia dengan hero, judul sedang tayang, katalog lengkap, anime populer, genre, dan room nobar yang sedang berlangsung jika tersedia.
- Pengguna dapat menjelajah, mencari, memfilter genre/status, dan membuka detail anime dengan poster, sinopsis, skor, jumlah episode, serta daftar episode.
- Jika sumber eksternal tidak merespons, halaman memakai empty state yang menjelaskan masalah tanpa mengarang data katalog.

## 3. Streaming anime, film, dan series

**Status: menunggu verifikasi Preview**

- Halaman tonton anime memakai stream HLS/media yang diperoleh melalui resolver/proksi sumber; tidak ada berkas video yang disimpan oleh aplikasi.
- Seksi Film & Series menampilkan Film Indonesia, Film Populer, Drakor, dan Dracin dari TMDb dengan judul, tanggal, skor, poster/backdrop, sinopsis, pemain, trailer, serta detail musim/episode series saat tersedia.
- Halaman tonton film/series memakai provider iframe yang tersedia, pemilih server, dan tautan untuk membuka provider di tab baru jika iframe ditolak.
- Keterbatasan film dinyatakan jujur: mode nobar film memakai countdown dan reload serentak, bukan sinkronisasi frame-per-frame dari currentTime iframe pihak ketiga.

## 4. Nobar realtime dan chat

**Status: menunggu verifikasi Preview**

- Pengguna dapat membuat room publik atau privat, memilih konten, membagikan tautan, masuk sebagai peserta, melihat daftar peserta, dan mengakhiri room sebagai host.
- Host mengendalikan play/pause, seek, dan pergantian episode untuk anime; peserta mengikuti pemutaran dengan toleransi drift yang dijelaskan di dokumentasi sumber.
- Room film menyediakan mode sinema dengan hitung mundur 3-2-1 yang terlihat oleh host dan peserta, lalu memuat ulang iframe bersama.
- Chat room realtime, riwayat pesan terbaru, status koneksi, dan badge host tersedia tanpa menghilangkan konteks video.

## 5. Akun, koleksi, dan riwayat

**Status: menunggu verifikasi Preview**

- Pengguna dapat mendaftar, masuk, keluar, dan melihat status akun dalam bahasa Indonesia.
- Sesi aplikasi tetap memakai cookie HttpOnly dari model akun sumber; pada HTTPS Preview, `SESSION_COOKIE_SAMESITE=none` dan `SESSION_COOKIE_SECURE=true` digunakan secara eksplisit, sedangkan mode HTTP lokal tetap `lax` dan non-secure.
- Pengguna yang masuk dapat menambah/menghapus favorit, mencatat progres/riwayat tontonan, menghapus satu entri, dan membersihkan riwayat.

## 6. Desain responsif dan aksesibilitas

**Status: selesai dari source, menunggu inspeksi Preview**

- Visual dark cinematic editorial memakai aksen cyan, panel gelap/glass, rail konten, status live, dan hierarki tipografi Geist + Geist Mono.
- Layout responsif untuk desktop dan mobile dengan bottom navigation pada layar kecil.
- Fokus keyboard terlihat, label ARIA dasar tersedia, skeleton/toast/empty state digunakan, dan animasi menghormati `prefers-reduced-motion`.

## 7. Kontrak WebDev dan route manifest

**Status: selesai**

- `app.config.ts` disiapkan dengan metadata logo proyek.
- `frontend/public/manus-routes.json` mendeklarasikan seluruh route halaman statis, dinamis, auth, film, watch, dan nobar.
- Runtime proyek memakai port 3000 untuk Preview; backend memakai port 4000 dan frontend meneruskan `/api/*` serta `/socket.io/*` melalui rewrite same-origin.

## 8. Build, checkpoint, dan handoff Preview

**Status: menunggu verifikasi**

- Dependency diinstal dari lockfile setelah package manager npm dipin.
- Diagnostics TypeScript terdaftar untuk proyek WebDev.
- Typecheck frontend/backend, unit test backend, build frontend, readiness endpoint, route manifest, dan halaman utama dijalankan sebelum handoff.
- Perubahan disimpan sebagai checkpoint Manus. URL yang diserahkan hanya Preview yang benar-benar berjalan; publikasi permanen tidak dilakukan tanpa permintaan eksplisit.
