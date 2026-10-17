# Spec: Seksi Film & Series (Nobar King Akbar)

Status: **SELESAI & terverifikasi live** · Dibuat: 18 Okt 2026 · Pemilik: Akbar
(revisi sinkronisasi film: lihat catatan "mode sinema" di §5)

## 1. Objective

Menambahkan **seksi Film & Series** ke Nobar King Akbar Anime, memakai pengalaman
nobar (ruang tonton bareng + chat realtime + kontrol host) yang sudah ada, tanpa
mengubah perilaku seksi Anime yang sudah berjalan.

Referensi struktur UI: https://github.com/Alfianax01/RuangSinema (dipakai sebagai
**bukti kualitas & pola interaksi**, bukan untuk dikloning — copy, aset, dan trade
dress tidak diambil).

**Definisi sukses**

- Pengguna bisa menjelajah katalog film/series dengan poster & metadata nyata,
  membuka detail (sinopsis, pemain, trailer, season/episode untuk series), lalu
  memutar di halaman tonton dengan pemutar yang sama.
- Ruang nobar film berfungsi: host mengatur judul/episode dan memicu "mulai bareng";
  peserta memuat ulang pemutar pada detik yang sama (mode sinema). Drift frame-per-frame
  **tidak diklaim** karena kontrol berada di dalam iframe penyedia — lihat catatan revisi.
- Tidak ada data karangan: katalog, poster, episode, dan status ruang semua nyata.
- UI rapi & konsisten dengan seksi Anime (tidak "AI slop"): tipografi editorial,
  grid poster yang tertata, hierarki jelas, responsif di 360–1440 px.

## 2. Scope

**Termasuk**

- Kategori (baris katalog): Film Indonesia, Film Populer (global), Drakor,
  Dracin (drama China), Dorama/Anime Series (opsional menyusul).
- Halaman: `/film` (katalog), `/film/[id]` (detail film/series), pemutaran lewat
  halaman `/watch` yang sudah ada, dan pembuatan ruang nobar untuk konten film.
- Pencarian film/series (debounced) yang menyatu dengan pencarian yang ada.
- Sumber stream: embed provider publik berbasis ID TMDb, dikirim ke pemutar sebagai
  `StreamSource` bertipe `iframe`. (Rencana awal "resolusi ke media langsung" **dibatalkan**:
  CDN provider membalas HTTP 428 untuk IP server — bukti di `/home/ubuntu/film-findings.md`.)

**Tidak termasuk (fase ini)**

- Sumber film bajakan khusus (scraper situs film lokal) — hanya kalau diminta
  terpisah, karena butuh riset domain & pemblokiran seperti kasus otakudesu.
- Unduhan/offline, notifikasi push, transcode server-side.
- Perubahan pada skema auth, room, atau chat (dipakai apa adanya).

## 3. Sumber data (terverifikasi 18 Okt 2026 dari sandbox)

| Sumber | Peran | Bukti uji |
|---|---|---|
| TMDb API v3 | Metadata katalog, poster/backdrop, sinopsis, pemain, trailer, season/episode, pencarian | `/discover/movie?with_original_language=id` → **6.985 hasil**; `/discover/tv?with_original_language=ko` → **11.117 hasil**; `/movie/550?append_to_response=credits,videos` → Fight Club + pemain + trailer ✓ |
| `image.tmdb.org` | Gambar poster (`/w500`) & backdrop (`/original`) | Publik, tanpa key ✓ |
| `vidlink.pro` | Provider stream #1 (film & series) | Resolver → **MP4 langsung** untuk `/movie/550` **dan** `/tv/1399/1/1` ✓ |
| `www.2embed.cc` | Provider cadangan #1 | HTTP 200 dari sandbox ✓ (uji resolusi menyusul) |
| `multiembed.mov` | Provider cadangan #2 | HTTP 404 untuk format URL di referensi → perlu uji format ulang |
| `vidsrc.vip`, `embed.su`, `player.smashy.stream` | Kandidat lain | Tidak terjangkau dari sandbox (000) → **tidak dipakai** sampai terbukti |

Catatan: ketersediaan provider bisa berubah; karena itu daftar provider dibuat
**berperingkat** dan setiap kandidat diverifikasi (media harus menjawab 200/206
non-HTML) sebelum dilaporkan ke pemutar.

## 4. Arsitektur (memakai ulang lapisan yang ada)

```
Pengguna → Next.js (film pages) → Backend :4000
                                   ├── adapters/tmdb/  (metadata, cache 10 menit)
                                   └── services/stream.service
                                         └── resolveFilmStream → daftar embed berperingkat
                                             (vidlink · 2embed · multiembed) sebagai iframe
                                             → diputar di browser pengguna (tanpa proksi)
```

> **Revisi (bukti: `/home/ubuntu/film-findings.md`):** jalur "resolver → media langsung →
> proxy" tidak mungkin untuk film karena CDN penyedia membalas **HTTP 428** untuk IP server
> (dari backend maupun dari Chromium di sandbox). Karena itu sumber film dikirim sebagai
> `iframe` dan pemutaran terjadi di perangkat pengguna.

**ID konten**

- `tmdb:movie:<id>` → film
- `tmdb:series:<id>` → series (episode: `s<season>e<episode>`)
- Seksi Anime tetap `otakudesu:<id>` / `oploverz:<slug>`

**Endpoint baru (kontrak tetap: `{status, data, meta}` + error terstruktur)**

| Endpoint | Fungsi |
|---|---|
| `GET /api/film/rows` | Baris katalog untuk halaman /film (film indo, populer, drakor, dracin) |
| `GET /api/film/search?q=` | Pencarian multi (film + series) |
| `GET /api/film/:id` | Detail (metadata + pemain + trailer + season/episode untuk series) |
| `GET /api/film/:id/episodes/:episodeId/stream` | Daftar sumber embed (`type: "iframe"`) untuk film/series |

Endpoint anime yang ada tidak berubah.

## 5. Kontrak data (ringkas)

- `FilmCard`: id, kind (`movie`/`series`), title, posterUrl, backdropUrl, year,
  score (TMDb 0–10), genres[], overview singkat.
- `FilmDetail`: di atas + runtime/seasons, cast[] (nama + peran + foto), trailerYoutubeKey,
  seasons[] + episodes[] (nomor, judul, tanggal, still).
- `EpisodeStreamResolution`: sama seperti sekarang (`sources[]`, `picked`,
  `proxyUrl` — `null` untuk sumber iframe) sehingga pemutar & ruang tidak perlu diubah.

## 6. UI/UX (arahan visual)

**Tesis visual**: *bioskop malam — gelap pekat, tipografi editorial, satu aksen
hangat, poster sebagai bintang; motion hanya untuk memandu, bukan hiasan.*

- Halaman `/film`: hero film unggulan (backdrop + judul besar + CTA "Tonton" &
  "Buat Nobar"), lalu baris katalog horizontal per kategori dengan kartu poster
  2:3 (judul, tahun, rating kecil). Bukan tumpukan kartu seragam tanpa alasan.
- Halaman detail: backdrop penuh, poster + info kiri, sinopsis, daftar pemain
  (foto bulat + nama + peran, scroll horizontal), trailer (klik untuk memuat
  YouTube — tanpa autoplay), untuk series: pemilih season + daftar episode.
- Navigasi: tambah item **Film** di navbar (Anime · Film · Nobar · Koleksi).
- Pencarian: satu kotak, hasil dikelompokkan (Anime / Film & Series).
- Mobile: baris katalog tetap bisa di-scroll dengan rapi, target sentuh ≥ 44 px,
  tidak ada overflow horizontal; detail menumpuk vertikal.
- Aksesibilitas: kontras ≥ 4,5:1 untuk teks, fokus terlihat, `prefers-reduced-motion`
  dihormati, alt text pada poster, ikon SVG (bukan emoji).
- Aturan anti-slop: tanpa emoji sebagai ikon, tanpa gradien ungu, tanpa glassmorphism
  berlebihan, tanpa teks raksasa yang mengisi ruang kosong.

## 7. Aturan anti data palsu

1. Tidak ada poster/episode/judul yang dikarang; jika TMDb tidak punya poster,
   tampilkan placeholder netral (bukan gambar acak).
2. Kategori yang tidak punya data → keadaan kosong yang jujur ("belum ada data"),
   bukan daftar contoh.
3. Kegagalan sumber → pesan error terstruktur (`code`, `message`, `requestId`),
   bukan pemutar kosong tanpa penjelasan.
4. Provider embed dilaporkan apa adanya sebagai `iframe`; bila provider menolak tampil di
   dalam frame, UI menyediakan tautan "buka di tab baru" dan tidak mengklaim pemutaran berhasil.

## 8. Perintah & pengujian

```
Build:   (frontend) npm run build   |  (backend) npx tsc --noEmit
Test:    (backend) npx vitest run
Cek main: (backend) npx tsx scripts/... / manual curl endpoint
E2E:     node scripts/film-ui-check.js (katalog/detail/tonton), node scripts/film-room-check.js (nobar film)
Visual:  node scripts/film-ui-check.js (screenshot 21–39)
```

**Strategi pengujian**

- Unit: adapter TMDb (normalisasi payload → kontrak, id, episode), pemeringkatan
  provider, parsing durasi/rating. Fixture disimpan dari respons nyata.
- Integrasi: endpoint `/api/film/*` diuji dengan server hidup (metadata nyata).
- E2E pemutaran: skrip Puppeteer membuka halaman tonton film → pastikan iframe penyedia
  termuat (vidlink) + pemilih server + tautan tab baru berfungsi. `currentTime` **tidak**
  dapat dibaca dari iframe pihak ketiga, jadi tidak diklaim.
- E2E nobar: dua browser (host + tamu) → cek hitung mundur 3-2-1 muncul di keduanya,
  iframe dimuat ulang, dan chat realtime tetap jalan.
- Visual: screenshot desktop 1440 & mobile 390 untuk /film dan detail film.

## 9. Batasan

- **Selalu**: jaga endpoint anime & room tetap kompatibel; jalankan tsc + tes
  sebelum menandai selesai; pakai data nyata; tangani error terstruktur.
- **Tanya dulu**: menambah dependensi baru, mengubah skema database, memakai
  kredensial pihak ketiga di luar yang disetujui, menambah provider baru yang
  belum terbukti, mengubah navigasi yang memengaruhi seksi Anime.
- **Jangan**: mengkloning aset/copy repo referensi; menulis data contoh; menaruh
  API key di kode klien (key hanya di server / env); membuka proxy terbuka tanpa
  tanda tangan HMAC.

## 10. Pertanyaan terbuka

1. **TMDb API key**: pakai key publik dari repo RuangSinema (langsung jalan,
   bisa diganti kapan saja lewat env `TMDB_API_KEY`) **atau** kamu kirim key
   TMDb sendiri (gratis, 1 menit di themoviedb.org → Settings → API)?
2. Kategori awal: **Film Indonesia + Film Populer + Drakor + Dracin** — setuju,
   atau ada yang mau ditambah/dikurangi (mis. Dorama Jepang, Anime Series)?
3. Nama menu: **"Film"** (menaungi film + series) atau dipisah "Film" & "Series"?

## 11. Checklist verifikasi (sebelum dinyatakan selesai)

- [x] Katalog film memuat poster & metadata nyata (81 kartu di `/film`, screenshot 21–22)
- [x] Detail film memuat pemain, trailer (GDYwcjhvD-Y), dan (untuk series) season/episode
- [x] Halaman tonton film memuat iframe penyedia + pemilih 3 server + tautan tab baru
- [x] Nobar film terverifikasi: hitung mundur 3-2-1 di host & tamu, iframe dimuat ulang,
      chat realtime (screenshot 33–39)
- [x] Pencarian film & anime tetap akurat, tanpa hasil karangan
- [x] `npx tsc --noEmit` bersih (backend & frontend), `npx vitest run` 16/16, `next build` sukses
- [ ] Halaman lama (anime, room, koleksi) tidak berubah perilakunya
- [ ] Tidak ada overflow horizontal di 360/390/768/1440 px
- [ ] Key TMDb tidak pernah dikirim ke klien
