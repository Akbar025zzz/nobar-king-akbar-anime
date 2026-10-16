# Deploy Permanen — Nobar King Akbar Anime

Panduan ini membuat situs berjalan **24/7 di server sendiri** (VPS / Cloud Computer),
bukan lagi di sandbox sementara. Semua layanan berjalan lewat Docker Compose dan
otomatis hidup lagi setelah server reboot.

---

## 1. Kebutuhan server

| Kebutuhan | Nilai | Catatan |
|---|---|---|
| OS | Ubuntu 24.04 LTS | apa pun yang punya Docker juga boleh |
| RAM | **4 GB disarankan** (2 GB minimum, 1 GB + swap berisiko) | dua proses Chromium (scraper + resolver) adalah pemakan memori terbesar |
| Disk | 10 GB | image Docker + PostgreSQL + Chromium |
| Trafik keluar | lihat catatan di bagian 7 | setiap pemutaran ±140 MB (720p) lewat proksi |
| Port | 80 (+443 bila HTTPS) | dibuka lewat firewall |

Layanan yang dijalankan Compose:

| Service | Fungsi | Port internal |
|---|---|---|
| `postgres` | database pengguna, room, chat, favorit, riwayat | 5432 |
| `wajik-anime-api` | sumber konten (otakudesu, sub Indo) lewat Chromium | 4200 |
| `resolver-api` | ubah embed player → URL media langsung (Puppeteer) | 4100 |
| `backend` | REST API + Socket.IO (realtime nobar) | 4000 |
| `frontend` | Next.js 15 (SSR) | 3001 |
| `gateway` | nginx: satu origin untuk browser | 80 |

---

## 2. Instalasi Docker

```bash
sudo apt update && sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker   # agar tanpa sudo
docker compose version                            # pastikan plugin compose ada
```

## 3. Ambil kode

```bash
sudo mkdir -p /opt && cd /opt
sudo git clone https://github.com/<akun>/nobar-king-akbar-anime.git
sudo chown -R $USER:$USER /opt/nobar-king-akbar-anime
cd /opt/nobar-king-akbar-anime
```

> Tanpa GitHub? Salin folder proyek (tanpa `node_modules`, `.next`, `.env`) ke server,
> mis. dengan `scp -r nobar-king-akbar-anime user@SERVER:/opt/`.

## 4. Konfigurasi rahasia

```bash
cp deploy/.env.production.example .env
# buat nilai rahasia
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "STREAM_PROXY_SECRET=$(openssl rand -hex 32)"
echo "RESOLVER_API_KEY=$(openssl rand -hex 24)"
nano .env      # tempel hasil di atas, isi PUBLIC_URL dan GATEWAY_PORT
```

Isi `.env` yang benar untuk tahap awal (tanpa domain):

```env
PUBLIC_URL=http://<IP-PUBLIK-SERVER>
GATEWAY_PORT=80
```

> `PUBLIC_URL` dipakai backend untuk origin/CORS. Kalau nanti sudah pakai domain + HTTPS,
> ubah ke `https://domainmu` lalu `docker compose up -d` lagi.

## 5. Buka firewall & jalankan

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp        # hanya bila memakai HTTPS
sudo ufw status

docker compose up -d --build   # build pertama ±5–10 menit (unduh Chrome for Testing)
docker compose ps              # semua harus "running"/"healthy"
```

Uji cepat:

```bash
curl -s http://127.0.0.1/api/health        # {"status":"success",...}
curl -s http://127.0.0.1/api/anime/ongoing | head -c 200
```

Sekarang situs sudah bisa dibuka di `http://<IP-PUBLIK-SERVER>`.

## 6. Auto-start setelah reboot (wajib)

```bash
sudo cp deploy/nobar-king.service /etc/systemd/system/
sudo sed -i "s#/opt/nobar-king-akbar-anime#$(pwd)#g" /etc/systemd/system/nobar-king.service
sudo systemctl daemon-reload
sudo systemctl enable --now nobar-king.service
systemctl status nobar-king.service --no-pager
```

Uji: `sudo reboot`, tunggu 1–2 menit, buka situs lagi — layanan harus hidup sendiri.

## 7. Domain + HTTPS (disarankan)

1. Beli domain di [Settings → Purchased Domains](https://manus.im/app#settings/data-controls/purchased-domains)
   (atau registrar mana pun).
2. Buat **A record** `nobar.domainmu.com` → IP publik server.
3. Pindahkan gateway container ke port lokal, lalu terminasi TLS di nginx host:

```bash
sed -i 's/^GATEWAY_PORT=.*/GATEWAY_PORT=8080/' .env
sed -i 's#^PUBLIC_URL=.*#PUBLIC_URL=https://nobar.domainmu.com#' .env
docker compose up -d

sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-tls.conf /etc/nginx/sites-available/nobar-king
sudo sed -i 's/nobar\.domainmu\.com/nobar.domainmu.com/g' /etc/nginx/sites-available/nobar-king
sudo ln -sf /etc/nginx/sites-available/nobar-king /etc/nginx/sites-enabled/nobar-king
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nobar.domainmu.com      # sertifikat otomatis + perpanjangan
```

4. Buka `https://nobar.domainmu.com` — pastikan login, tonton, dan room realtime berjalan.

> Cookie sesi memakai `SameSite=Lax`; dengan HTTPS + domain sendiri semuanya normal.
> Jangan pakai IP+HTTP untuk produksi kalau pengguna akan login.

## 8. Trafik keluar & biaya

Setiap pemutaran video **dilewatkan server ini** (±140 MB per episode 720p), karena CDN
sumber tidak mengirim header CORS sehingga browser tidak bisa menariknya langsung.
Artinya trafik keluar cepat terpakai:

| Kuota | Perkiraan pemutaran 720p per bulan |
|---|---|
| 200 GB | ±1.400 pemutaran |
| 500 GB | ±3.500 pemutaran |
| 1000 GB | ±7.000 pemutaran |

- Di Cloud Computer, aktifkan **auto top-up** agar server tidak mati saat kuota habis:
  `Settings → Usage → Cloud computers → Manage budget`.
- Kalau trafik diprediksi besar, pertimbangkan tier lebih tinggi atau CDN sendiri di depan.

## 9. Backup & pemulihan

```bash
# dump database (jalankan terjadwal, mis. cron harian)
docker compose exec -T postgres pg_dump -U nobar nobar_king | gzip > backup-$(date +%F).sql.gz

# pulihkan
gunzip -c backup-2026-10-16.sql.gz | docker compose exec -T postgres psql -U nobar -d nobar_king
```

Di Cloud Computer, snapshot disk harian juga tersedia di halaman pengaturan komputer.
Simpan berkas `.env` di tempat aman (tanpa itu, database tidak bisa dibuka).

## 10. Update rutin

```bash
cd /opt/nobar-king-akbar-anime
git pull
docker compose up -d --build      # image yang berubah saja yang di-build ulang
docker image prune -f             # opsional: buang image lama
```

- **Domain sumber berubah** (otakudesu berpindah alamat): sunting
  `wajik-anime-api/src/configs/otakudesu.config.ts`, lalu `docker compose up -d --build wajik-anime-api`.
- **Daftar anime/episode** tidak perlu di-update manual — selalu diambil langsung dari situs
  sumber saat pengunjung membuka halaman (cache 5 menit).

## 11. Pemantauan & pemecahan masalah

```bash
docker compose ps                       # status + health
docker compose logs -f backend          # log realtime satu service
docker compose logs --tail=100 wajik-anime-api
curl -s http://127.0.0.1/api/health
```

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Halaman katalog kosong | Cloudflare menantang Chromium / domain sumber pindah | cek `docker compose logs wajik-anime-api`, perbarui domain di `otakudesu.config.ts` |
| Video tidak bisa diputar | embed sumber berubah / resolver gagal sesaat | tekan "Coba lagi" di halaman tonton; cek log `resolver-api` |
| Server terasa lambat / OOM | RAM kurang (dua Chromium + Postgres) | naikkan tier RAM, atau jalankan di server ≥4 GB |
| Room realtime tidak tersambung | firewall/proxy memblokir WebSocket | pastikan port 80/443 terbuka dan gateway nginx tidak diubah |
| 502 dari gateway | salah satu container mati | `docker compose ps` lalu `docker compose up -d` |

## 12. Checklist go-live

- [ ] `docker compose ps` → semua `running`/`healthy`
- [ ] `http://<IP>` atau `https://domain` menampilkan beranda dengan poster asli
- [ ] Daftar akun → login → tambah favorit → muncul di profil
- [ ] Buka episode → video berjalan (720p) → geser slider → subtitle tampil
- [ ] Buat room nobar → buka di perangkat kedua → play/pause tersinkron + chat masuk
- [ ] `systemctl is-enabled nobar-king.service` → `enabled`
- [ ] `.env` tersimpan aman + backup database pertama dibuat
- [ ] Auto top-up trafik diaktifkan (Cloud Computer)
