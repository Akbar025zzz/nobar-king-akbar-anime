# Panduan Uji Kelayakan Panel (Pterodactyl) — Nobar King Akbar Anime

Tujuan: memastikan **Chromium bisa hidup di container panelmu** dan **bisa melewati Cloudflare
otakudesu** (sumber konten sub-Indo). Ini penentu apakah situs bisa dijalankan di panel,
karena scraper konten dan resolver embed memerlukan Chromium.

Waktu: ±3–5 menit (sebagian besar untuk mengunduh Chromium ±150 MB).

---

## Berkas yang dibutuhkan

[panel-deploy-test.zip](https://files.manuscdn.com/user_upload_by_module/session_file/310519664026594560/kJMHgIlTtJmwAyjr.zip)

Isinya: `test.js` (program uji), `package.json` (dependensi + skrip), dan alias
`index.js` / `server.js` / `main.js` / `bot.js` / `app.js` (semua memanggil tes yang sama)
supaya cocok dengan egg apa pun.

---

## Langkah

**1. Unggah ke server**
Panel → pilih server → tab **Files** → unggah `panel-deploy-test.zip` ke folder root
(drag & drop atau tombol Upload).

**2. Ekstrak**
Klik **⋯** pada berkas zip → **Unarchive**. Akan muncul folder `panel-test`.

**3. Arahkan berkas utama (Startup)**
Buka tab **Startup** → cari variabel berkas utama, biasanya bernama salah satu dari:
`MAIN_FILE`, `SERVER_JS_FILE`, `JS_FILE`, `STARTUP_FILE`, `NODE_FILE`, `FILE`.
Ubah nilainya menjadi:

```
panel-test/index.js
```

Catatan: kalau perintah startup egg-mu `npm start` (bukan `node <berkas>`), pakai
`panel-test` sebagai working directory atau ubah perintah ke `node panel-test/index.js`.

**4. Jalankan**
Buka tab **Console** → tekan **Start**. Tunggu 2–5 menit.
Urutan keluaran yang normal:

```
chrome    : belum ada → mengunduh (1–3 menit)…
unduh     : selesai (status 0)
browser   : Chrome/1xx.0...
judul     : ...
cloudflare: LOLOS
ongoing   : HTTP 200 (xxxxx karakter)
STATUS: LOLOS
```

**5. Ambil hasilnya**
Salin isi console, atau buka tab **Files** → `panel-test-result.txt` → salin isinya.
Kirim ke saya (teks atau screenshot).

---

## Arti hasil

| STATUS | Artinya |
|---|---|
| **LOLOS** | Chromium hidup **dan** otakudesu bisa diakses → panel bisa dipakai (perlu porting ke mode 1 proses) |
| **SEBAGIAN** | Chromium hidup, tapi Cloudflare/endpoint dari IP panel diblokir → perlu jalur scraper alternatif |
| **GAGAL** | Chromium tidak bisa jalan (library sistem tidak ada) atau puppeteer gagal dipasang → panel tidak bisa dipakai untuk stack ini |

---

## Pemecahan masalah

**`puppeteer belum terpasang (jalankan npm install)`**
Egg tidak menjalankan `npm install` otomatis. Solusi: di tab Startup, tambahkan
`npm install && ` di depan perintah, atau tekan tombol **Reinstall** di panel
(menjalankan install script egg).

**`Chromium tidak bisa jalan ... error while loading shared libraries: libnss3.so`**
Container tidak punya library sistem yang dibutuhkan Chromium. Ini **tidak bisa
diperbaiki dari dalam panel** (butuh root/apt). Kalau ini yang muncul → panel tidak
cocok, lanjut ke VPS.

**Proses berhenti sendiri (OOM)**
RAM server kurang. Cek `RAM total` di keluaran; minimal yang aman 2 GB (Chromium ±400–700 MB).

**Unduhan Chrome lambat/gagal**
Server panel butuh akses keluar ke `storage.googleapis.com`. Kalau diblokir,
hasilnya `GAGAL` dan penyebabnya bukan di sisi kita.

---

## Ingat

Uji ini **mengubah perintah startup** server yang dipakai, jadi kalau server itu
menjalankan bot Discord, bot akan berhenti selama tes. Pakai server kosong/baru kalau ada.
Setelah selesai, kembalikan nilai variabel startup ke semula dan tekan **Restart**
supaya bot-mu jalan lagi.
