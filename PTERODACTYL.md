# Deployment Pterodactyl

Server memakai egg Node.js 22 dan startup command `node start.cjs`. Launcher memakai ekstensi `.cjs` karena package root proyek menggunakan `type: module`. Upload seluruh isi proyek ke root server, termasuk folder `frontend`, `backend`, `wajik-anime-api`, dan `anime1v-api`. Jangan upload `node_modules` atau `.next`.

## Konfigurasi melalui file `.env`

Jika egg tidak menyediakan tombol untuk menambah variable baru, buka tab **Files**, buat file bernama `.env` di root server, lalu isi:

```env
PUBLIC_URL=http://atlas.ypnode.my.id:10832
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=lax
SESSION_COOKIE_NAME=nka_session
RESOLVER_API_KEY=ganti-dengan-random-secret
STREAM_PROXY_SECRET=ganti-dengan-random-secret
```

Jangan masukkan file `.env` ke arsip publik atau Git. Launcher membaca file ini saat startup.

Jika panel mengizinkan variable tambahan pada **Startup → Variables**, gunakan nilai yang sama sebagai alternatif:

```env
PORT=10832
PUBLIC_URL=http://IP-ATAU-DOMAIN:10832
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
SESSION_COOKIE_NAME=nka_session
RESOLVER_API_KEY=ganti-dengan-random-secret
STREAM_PROXY_SECRET=ganti-dengan-random-secret
```

Untuk domain HTTPS, ubah `PUBLIC_URL` menjadi `https://domainmu` dan gunakan:

```env
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
```

`DATABASE_URL` wajib menunjuk ke PostgreSQL yang dapat diakses dari node Pterodactyl. Database pada tab **Databases** Pterodactyl umumnya MySQL/MariaDB, sedangkan aplikasi ini memakai PostgreSQL; jangan memasukkan URL MySQL ke variabel tersebut.

## Menjalankan

Startup command:

```bash
node start.cjs
```

Pada start pertama launcher memasang dependency empat service, menjalankan migrasi database, menunggu backend sehat, melakukan build frontend, lalu menjalankan Next.js pada allocation utama. Proses Chromium pada katalog anime dan resolver membutuhkan resource besar; gunakan minimal 4 GB RAM bila ingin semua fitur aktif.

## Uji

Setelah server menyala, buka:

```text
http://IP-ATAU-DOMAIN:10832/api/health
```

Respons harus berisi `status: success` dan `db: up`. Kemudian buka URL publik utama. WebSocket memakai origin yang sama sehingga tidak memerlukan allocation port tambahan.

## Catatan

Launcher ini sengaja memakai satu server Pterodactyl untuk beberapa proses. Untuk produksi yang lebih stabil, pisahkan PostgreSQL dan service resolver/katalog ke server/container terpisah, atau gunakan Docker Compose pada VPS.
