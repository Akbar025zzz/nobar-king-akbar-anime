# Rencana Implementasi — Nobar King Akbar Anime

## Ringkasan

Mengubah aplikasi yang diunggah menjadi situs web terkelola yang dapat dijalankan di Preview WebDev tanpa menghilangkan fitur utama yang sudah ada: katalog anime sub Indo, film & series dari TMDb, streaming, room nobar realtime, chat, akun, favorit, dan riwayat tontonan.

Sumber sudah berisi frontend Next.js 15, backend Express + Socket.IO, adapter sumber anime, resolver embed, adapter TMDb, konfigurasi Docker Compose, dokumentasi, serta bukti pengujian sebelumnya. Implementasi akan memakai sumber tersebut sebagai basis, bukan membuat ulang aplikasi dari nol.

## Pendekatan implementasi

1. Salin seluruh isi aplikasi sumber ke root proyek WebDev dan pertahankan pemisahan `frontend/`, `backend/`, `wajik-anime-api/`, `anime1v-api/`, `deploy/`, `scripts/`, dan `docs/`.
2. Jalankan dependency install dan pemeriksaan typecheck/build yang sesuai untuk frontend dan backend. Jangan memasukkan `.env` berisi nilai rahasia ke checkpoint.
3. Jalankan Next.js sebagai listener utama Preview pada port 3000 dan backend Express + Socket.IO pada port 4000; gunakan rewrite Next untuk `/api/*` dan `/socket.io/*`, sehingga browser tetap memakai satu origin.
4. Tambahkan kontrak WebDev yang wajib: `public/manus-routes.json`, metadata logo proyek di root, listener `0.0.0.0` pada port Preview, dan penyesuaian cookie sesi agar kompatibel dengan embedded HTTPS Preview. Model akun/email-password dari aplikasi sumber tetap dipertahankan; mode Preview mengaktifkan `SESSION_COOKIE_SAMESITE=none` dan `SESSION_COOKIE_SECURE=true` secara eksplisit, sementara HTTP lokal memakai default `lax`/non-secure.
5. Pertahankan perilaku konten yang sudah terdokumentasi: anime memakai resolver/proksi stream, film memakai provider iframe dengan mode sinema untuk nobar karena sinkronisasi frame-per-frame tidak tersedia.
6. Gunakan fallback error yang sudah ada agar halaman utama tetap dapat dirender ketika sumber eksternal atau service pendukung sedang tidak merespons, tanpa membuat data katalog fiktif.
7. Simpan checkpoint setelah verifikasi. Publikasi permanen tidak dilakukan kecuali diminta; hasil utama yang diserahkan adalah Preview yang berjalan.

## Struktur proyek

- `frontend/`: Next.js App Router, halaman katalog, detail, watch, film, room, auth, profil, komponen UI, tema sinematik.
- `backend/`: Express REST API, Socket.IO realtime, sesi akun, room/chat, koleksi pengguna, stream, adapter TMDb dan sumber anime.
- `wajik-anime-api/`: service pengambil katalog dan detail anime sub Indo yang sudah divendor dan dipatch.
- `anime1v-api/`: service resolver embed anime ke media langsung.
- `deploy/` dan `docker-compose.yml`: gateway dan konfigurasi service untuk stack multi-proses.
- `public/manus-routes.json`: manifest route halaman untuk Preview/inspeksi platform.
- `plan.md` dan `TODO.md`: rencana, kriteria produk, dan status deliverable.

## Desain produk

### Arah visual yang dipilih: Dark cinematic editorial

- **Design Movement:** editorial streaming premium yang dipadukan dengan dashboard komunitas realtime.
- **Core Principles:** atmosfer gelap yang fokus pada artwork, hierarki editorial yang tegas, kontrol realtime yang mudah dipahami, dan mobile-first tanpa terasa seperti aplikasi utilitas.
- **Color Philosophy:** dasar ink hampir hitam menjaga poster dan backdrop menjadi pusat perhatian; cyan khas memberi rasa layar/gelombang sinkronisasi; violet, rose, amber, dan emerald hanya dipakai sebagai status fungsional.
- **Layout Paradigm:** alur vertikal berlapis dengan hero lebar, rail konten horizontal, panel room yang terasa seperti command center, dan whitespace asimetris; bukan grid kartu seragam sebagai satu-satunya struktur.
- **Signature Elements:** logo mark berbentuk tombol play, chip status live dengan titik berdenyut, dan panel kaca gelap dengan garis tepi tipis untuk metadata serta kontrol.
- **Interaction Philosophy:** setiap aksi penting memberi respons cepat dan jelas; CTA utama terasa seperti tombol mulai menonton, status host/peserta dibedakan secara visual, dan batasan provider film dijelaskan jujur.
- **Animation:** hover lift singkat pada kartu dan tombol, shimmer untuk loading, pulse lembut untuk live, transisi opacity/translate yang menghormati `prefers-reduced-motion`, tanpa animasi dekoratif yang mengganggu membaca sinopsis atau chat.
- **Typography System:** Geist sans untuk judul dan body agar modern/rapi; Geist Mono untuk kicker, status, angka, label server, dan metadata teknis. Judul besar padat, body 14–16px dengan line-height longgar, label uppercase kecil dengan tracking lebar.
- **Brand Essence:** tempat nonton anime, film, dan nobar yang menyatukan tontonan dengan momen realtime komunitas; hangat, teknis, kompak.
- **Brand Voice:** langsung, akrab, dan sinematik. Contoh: “Satu room, satu cerita, satu waktu.” dan “Pilih judulnya. Kami sinkronkan momennya.”
- **Wordmark & Logo:** mark play cyan di dalam bentuk rounded-square sebagai penanda mulai bersama, dipasangkan dengan wordmark “Nobar King Akbar” dan descriptor mono “Anime”.
- **Signature Brand Color:** cyan `#55cbd8`, dipakai untuk fokus, CTA, link aktif, dan aksen sinkronisasi.

## Keputusan data dan infrastruktur

- Fitur persisten membutuhkan server dan database, sehingga keduanya sudah dinyatakan pada proyek WebDev.
- Kode sumber saat ini menggunakan PostgreSQL melalui `pg`, sedangkan database terkelola WebDev bersifat MySQL-compatible. Karena migrasi ORM/SQL lintas database adalah perubahan besar dan tidak diminta pengguna, tahap ini memprioritaskan menjalankan stack sumber yang sudah tervalidasi dengan adapter database yang ada; kompatibilitas managed database akan diverifikasi sebelum mengklaim deployment produksi.
- Tidak ada video yang disimpan ke storage. URL katalog dan stream tetap berasal dari provider eksternal sesuai dokumentasi dan batasan legal proyek.
- Tidak akan menambahkan kredensial baru ke source. Nilai sensitif tetap melalui environment/secret atau file lokal yang tidak di-checkpoint.

## Alur build dan verifikasi

- Instal dependency dengan lockfile yang sudah ada, setelah menambahkan konfigurasi package manager yang aman bila diperlukan.
- Daftarkan diagnostics TypeScript untuk `frontend` dan `backend` melalui runtime WebDev sebelum batch perubahan kode pertama.
- Mulai service pada listener yang ditentukan WebDev, lalu cek readiness HTTP dan `GET /manus-routes.json`.
- Jalankan typecheck frontend/backend, unit test backend, dan build frontend. Bila dependency eksternal tidak tersedia, laporkan blocker spesifik tanpa mengganti data nyata dengan fixture fiktif.
- Gunakan inspeksi Preview/screenshot hanya untuk memastikan halaman utama dan breakpoint mobile setelah service siap.
- Commit perubahan aplikasi dan konfigurasi yang relevan ke checkpoint Manus; jangan mempublikasikan URL permanen tanpa permintaan eksplisit.
