# Todo: Seksi Film & Series (SPEC-film.md)

Status: **selesai & terverifikasi live** (18 Okt 2026) — kategori: Film Indonesia, Film Populer,
Drakor, Dracin. TMDb key: key publik dari repo referensi (bisa diganti lewat `TMDB_API_KEY`).

## Backend

- [x] T1 — Adapter TMDb (`adapters/tmdb/`): types, client, adapter normalisasi
  - `discover` film indo/drakor/dracin/populer + detail movie/tv + season + search berjalan nyata
- [x] T2 — Kontrak & env: `FilmCard`/`FilmDetail`/`FilmEpisode`, `ContentSource` + "tmdb",
  `ContentType` + "movie"/"series", `TMDB_API_KEY`/`TMDB_LANGUAGE`/`TMDB_TIMEOUT_MS`
- [x] T3 — Provider film (`stream.service.ts` → `resolveFilmStream`): daftar kandidat berperingkat
  (vidlink, 2embed, multiembed) — **berubah dari rencana awal**: URL media langsung tidak bisa
  diambil karena CDN menolak IP server (HTTP 428), jadi sumber dikirim sebagai `type: "iframe"`
  dan diputar di browser pengguna (bukti: `/home/ubuntu/film-findings.md`)
- [x] T4 — `film.service.ts`: rows katalog, pencarian, detail, episode series (fallback judul
  episode generik "Episode 3" diulang dengan `en-US`)
- [x] T5 — `stream.service.ts`: cabang tmdb (film/series) → daftar provider embed; anime tetap
  resolver + proksi HMAC
- [x] T6 — `film.controller.ts` + rute `/api/film/rows`, `/search`, `/:id`, `/:id/episodes/:ep/stream`
- [x] T7 — Integrasi ruang & koleksi agar menerima id film (`tmdb:*`) via `services/contentResolver.ts`
- [x] T8 — Unit test adapter + uji endpoint hidup (detail The Raid, GoT 8 musim, stream 3 sumber)

## Frontend

- [x] T9 — Tipe film di `lib/types.ts` + `episodeLabel` menerima bentuk minimal (anime & film)
- [x] T10 — Halaman `/film` (hero + 4 rail: Film Indonesia, Film Populer, Drakor, Dracin)
- [x] T11 — Halaman `/film/[id]` (detail, pemain, trailer YouTube, pemilih musim + episode)
- [x] T12 — Halaman tonton & ruang nobar sadar-sumber (anime vs film)
- [x] T13 — Navigasi "Film" (navbar + bottom nav) + pencarian gabungan di buat room
- [x] T14 — Poles UI/UX (dark cinematic, responsif 390–1440, a11y) + screenshot 21–39

## Verifikasi

- [x] T15 — Playback film E2E — **direvisi**: `currentTime` tidak dapat dibaca dari iframe pihak
  ketiga; yang diverifikasi adalah iframe penyedia benar-benar termuat (vidlink) + pemilih server
  + tautan "buka di tab baru" (`scripts/film-ui-check.js`)
- [x] T16 — Nobar film E2E — **direvisi** menjadi mode sinema: host "Mulai Bareng" → hitung mundur
  3-2-1 tampil di host & peserta → iframe dimuat ulang; chat realtime tetap jalan
  (`scripts/film-room-check.js`). Drift ≤ 0,5 dtk **tidak diklaim** karena kontrol berada di
  penyedia embed
- [x] T17 — tsc backend/frontend + vitest + build produksi
- [x] T18 — Cek halaman lama tidak rusak + dokumentasi (README, PROJECT_STATE, .env.example,
  docker-compose)
