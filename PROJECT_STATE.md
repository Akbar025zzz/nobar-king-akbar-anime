# PROJECT STATE — Nobar King Akbar Anime (internal notes)

## Status: SELESAI — live & terverifikasi (anime sub Indo + Film & Series TMDb)

- **Demo publik:** https://3000-irhefyuqda4fhazi9n5r4-24916fab.sg2.manus.computer
  (nginx :3000 → Next.js :3001 · /api + /socket.io → backend :4000)
- **Sumber konten:** `wajik-anime-api` :4200 (vendored dari wajik45/wajik-anime-api, scraper
  **otakudesu** sub Indo, diakses lewat Chromium hangat karena Cloudflare).
- **Mesin resolver:** `anime1v-api` :4100 (vendored) — kini hanya endpoint `/resolve`
  (embed desustream/vidhide → URL MP4/HLS langsung).
- **Database:** PostgreSQL 16 lokal (`nobar_king`).
- **Film & Series:** metadata dari **TMDb v3** (`adapters/tmdb/`), id `tmdb:movie:<id>` /
  `tmdb:series:<id>`, kategori Film Indonesia (`with_original_language=id`), Film Populer,
  Drakor (`ko`, tanpa variety), Dracin (`zh`). Pemutaran memakai **embed penyedia**
  (vidlink/2embed/multiembed) bertipe `iframe`; tidak ada proksi dan tidak ada berkas.
- Service sessions: `wajik-anime-api` (4200), `anime1v-api` (4100), `backend` (4000),
  `frontend` (3001, `next start`); nginx dijalankan manual di 3000.

## Keputusan penting: film tidak bisa di-sync frame-per-frame

`scripts/film-media-probe.js` membuktikan MP4 dari vidlink (`flood.sourcerrr.online`) membalas
**HTTP 428** baik dari backend maupun dari Chromium sandbox, dan `fetch` di dalam halaman gagal
(CDN memblokir IP datacenter). Artinya backend tidak mungkin membaca `currentTime` film untuk
sinkronisasi. Keputusan produk: **mode sinema** — host menekan "Mulai Bareng", backend mengirim
sinyal `player:sync` yang sudah ada, semua klien menampilkan hitung mundur 3-2-1 dari stempel
waktu server lalu memuat ulang iframe pada detik yang sama; chat & peserta tetap realtime.
Keterbatasan ini ditulis jujur di UI (`Mode sinema`) dan di README bagian Batasan.

## Verifikasi yang sudah lulus (build terakhir)

1. `backend` vitest — **16/16** (adapter wajik: normalisasi payload, skor/status, peringkat
   kandidat server, parsing URL & nomor episode).
2. `tsc --noEmit` backend & frontend — 0 error. `next build` — sukses (BUILD6, 12 rute).
3. API live: `/api/anime/ongoing` (25 judul), `/api/anime/search?q=one piece` (skor terparse),
   detail + daftar episode, resolusi stream ± 5,5 dtk (cache dingin).
4. Proksi stream: 206 + header `ftyp`/`moov` melewati backend dan gateway publik
   (pass-through `Readable.pipe`, playlist tetap di-rewrite).
5. `scripts/playback-check.js` — 720p 1280×720, `currentTime` 3,69→9,67 dtk, frame ter-decode,
   subtitle tampil (bukti: `docs/screenshots/05b-watch-playing.png`).
6. `scripts/room-playback-check.js` — host & peserta berjalan nyata, **drift 0,00–1,37 dtk**
   (toleransi 1,6 dtk; dua kali lulus: `ROOM PLAYBACK + SYNC VERIFIED`), jeda tersinkron.
7. `scripts/e2e-screenshots.js` — 20 tangkapan layar di `docs/screenshots/` (konten sub Indo).
8. **Film & Series (18 Okt 2026):**
   - `/api/film/rows` → 4 rail berisi poster TMDb nyata; `/api/film/search?q=the raid` →
     The Raid 2: Berandal, The Great Raid, …; detail `tmdb:movie:94329` → 7,4 · 101 menit ·
     18 pemain · trailer `GDYwcjhvD-Y`; `tmdb:series:1399` → 8 musim, 73 episode, judul episode asli.
   - Stream film/series → 3 sumber `iframe` (vidlink, 2embed, multiembed) tanpa proksi.
   - `scripts/film-ui-check.js` — 81 kartu film di `/film`, trailer YouTube termuat, pemilih musim
     berfungsi, iframe vidlink tampil di halaman tonton film & series, seksi film muncul di beranda,
     tampilan mobile 390 px rapi (screenshot 21–32).
   - `scripts/film-room-check.js` — room film: pencarian gabungan anime+film, "Mulai Bareng"
     memicu hitung mundur 3-2-1 pada host **dan** peserta, iframe dimuat ulang, chat realtime
     (screenshot 33–39).

## Fix penting yang ditemukan lewat verifikasi

- **Cloudflare di otakudesu.blog** menolak `fetch` biasa (403) → `browserFetch` (Chromium
  hangat + `fetch` di dalam page + retry tantangan) di `wajik-anime-api`.
- **Param rute Next ber-encoding ganda** (`%3A`) → `decodeRouteParam` di `frontend/lib/api.ts`.
- **Data Cache Next menyimpan 404 sementara** → diganti memo in-process yang hanya menyimpan
  respons sukses (permintaan gagal selalu diulang).
- **Proksi stream men-buffer Range terbuka** (`bytes=0-`, 147 MB) → hang/504 → kini
  pass-through streaming; playlist tetap dibaca untuk rewrite.
- **Sync peserta pra-metadata**: efek sync menunggu `readyState >= 1` + re-run saat `ready`.
- **Host resume** sekali per attachment (flag ref) · **room kosong** freeze + persist,
  ekstrapolasi dibatasi 30 menit · `host:change` dipromosikan di klien tanpa reload.
- **Catch-up host + tick 6 dtk**: kalau stream host tersendat (buffering) sementara timeline
  room berjalan, host ditarik kembali ke posisi kanonik (ambang 4 dtk); broadcast `player:sync`
  periodik dipercepat dari 10 dtk → 6 dtk sehingga drift peserta cepat konvergen.

## Patch wajik-anime-api (ringkas; detail di wajik-anime-api/PATCHES.md)

1. Baru: `src/helpers/browserFetch.ts` (Chromium hangat per origin, `fetch` in-page, retry).
2. `src/helpers/getHTML.ts`: parameter `viaBrowser` (permintaan ke-5).
3. `src/scrapers/otakudesu.scraper.ts`: `scrapeDOM` + `scrapeNonce`/`scrapeServer` via browser.
4. `src/configs/app.config.ts`: `PORT` dari env (dipakai 4200).
5. `package.json` + `Dockerfile`: puppeteer 24.43.1, basis `node:20-slim` + lib Chrome, port 4200.

## Patch anime1v-api (ringkas; detail di anime1v-api/PATCHES.md)

1. Resolver baru Zilla HLS (`zilla.resolver.js`) — tidak lagi dipakai untuk sumber ini.
2. `resolvers.js`: dispatch zilla + **desustream**, relaksasi blokir script, navigasi aman.
3. `http.js`: `isLikelyVideoUrl` menolak ekstensi aset.
4. `animeav1.service.js`: klasifikasi stream/embed/download + bucket embeds/downloads.
5. `anime.routes.js`: status passthrough + deteksi mediaType/server.

## Struktur deliverable

- `frontend/` Next.js 15 · `backend/` Express+Socket.IO · `wajik-anime-api/` sumber (vendored +
  PATCHES.md) · `anime1v-api/` mesin resolver (vendored + PATCHES.md)
- `scripts/` realtime-check · playback-check · room-playback-check · e2e-screenshots
  · film-ui-check · film-room-check · film-media-probe
- `deploy/` nginx (compose + lokal) · `docker-compose.yml` · `docs/screenshots/` · `README.md`

## Sisa / catatan

- Room uji "Uji Sinkronisasi Pemutaran" dibiarkan live untuk demo; room era Anime1V sudah
  dinonaktifkan (`is_active = false`).
- Sandbox URL bersifat sementara; untuk deploy permanen gunakan docker compose.
- Skrip puppeteer memakai `anime1v-api/node_modules` (dan `wajik-anime-api/node_modules`) via
  `require.resolve`.
- Domain sumber (otakudesu) bisa berganti; URL ada di `wajik-anime-api/src/configs/otakudesu.config.ts`.
- Selama pengujian, CDN `cdn.odcloud.net` sempat membatasi bandwidth ke sandbox (~55–200 KB/s);
  pemutaran ikut melambat sesaat. Ini murni kondisi jaringan sandbox — di deployment normal
  kecepatan kembali normal (pemutaran & sinkronisasi sudah terverifikasi ulang setelah pulih).
- nginx di sandbox dijalankan manual; ada watchdog (`pgrep nginx || sudo nginx` tiap 15 dtk)
  supaya demo tidak mati. Di Docker Compose nginx berjalan sebagai service `restart: unless-stopped`.
