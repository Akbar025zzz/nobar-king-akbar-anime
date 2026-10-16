# PATCHES — wajik-anime-api (vendored, modified)

This project vendors [wajik45/wajik-anime-api](https://github.com/wajik45/wajik-anime-api)
(MIT) as the **content source** of Nobar King Akbar Anime. The `otakudesu`
scraper (sub Indo) is the source we serve; everything else stays untouched.

Upstream assumes the target domains are directly fetchable. In practice
`otakudesu.blog` sits behind **Cloudflare bot management**: a plain
`fetch()` gets a 403 challenge page and the API returns empty lists. The
patches below make the same scraper work behind Cloudflare by routing the
requests through a real (headless) Chromium. They are additive — no upstream
parser logic was modified.

## 1. New: `src/helpers/browserFetch.ts`

A browser-backed `fetch`:

- keeps **one warm Chromium instance** (`puppeteer`, headless, `--no-sandbox
  --disable-dev-shm-usage --disable-blink-features=AutomationControlled`);
- keeps **one page per origin**; before a request the page performs a
  same-origin navigation so Cloudflare's JS challenge can run and
  `cf_clearance` cookies are stored;
- executes every request with `fetch()` **inside that page**, so it inherits
  the browser cookies, TLS/JA3 fingerprint and origin headers (this also makes
  the WordPress `admin-ajax.php` POSTs work);
- retries once when the response body still looks like a challenge
  (`just a moment`, `checking your browser`, …);
- returns `{ status, text, headers }` so callers can keep their normal
  status-code handling.

## 2. `src/helpers/getHTML.ts`

New optional 5th parameter `viaBrowser = false`. When `true` the HTML is
fetched through `browserFetch()` instead of `globalThis.fetch()`. The
sanitize / error handling paths are unchanged.

## 3. `src/scrapers/otakudesu.scraper.ts`

- `scrapeDOM()` now calls `getHTML(baseUrl, pathname, ref, sanitize, true)` —
  every otakudesu page (ongoing, completed, genre, search, anime detail,
  episode, server list) is fetched through the warm browser.
- `scrapeNonce()` and `scrapeServer()` (the `admin-ajax.php` calls that resolve
  the actual embed URL of a chosen server) now use `browserFetch()` with the
  same headers as before.

## 4. `src/configs/app.config.ts`

- `PORT: Number(process.env.PORT ?? 3001)` — the port is configurable so the
  service can run on **4200** next to the rest of the stack.

## 5. `package.json` + `Dockerfile`

- `puppeteer: 24.43.1` added as a dependency (its postinstall downloads
  Chrome for Testing);
- the Dockerfile was switched from `node:20-alpine` to `node:20-slim` and now
  installs the Debian runtime libraries Chrome needs, exposes **4200** and
  reuses the Chrome download from the build stage.

## 6. `src/helpers/browserFetch.ts` — idle shutdown (hemat RAM)

Chromium adalah bagian terberat dari layanan ini (±0,5 GB saat aktif). Untuk server kecil
(2 GB, sering dipakai bersama layanan lain seperti bot Discord), browser kini **ditutup
otomatis setelah `BROWSER_IDLE_MS` tanpa permintaan** (default 10 menit; profil hemat
memakai 5 menit) dan **diluncurkan kembali saat ada permintaan baru**. Cookie
`cf_clearance` tidak perlu diawetkan karena tantangan Cloudflare dilewati ulang dengan cepat.

Terver yang sama juga menghemat dari sisi resolver: lihat `anime1v-api/PATCHES.md`
(`RESOLVER_BROWSER_IDLE_MS`).

## Verification

Live checks against the running service (port 4200):

```bash
curl -s "http://localhost:4200/otakudesu/ongoing?page=1" | head -c 400
# → {"status":"success","data":{"animeList":[{"title":"...","animeId":"..."}],"pagination":...}}

curl -s "http://localhost:4200/otakudesu/search?q=one%20piece"
# → animeList with score/status parsed from the live site

curl -s "http://localhost:4200/otakudesu/episode/<episodeId>"
# → details.server.qualityList[].serverList[] (odcdn, odstream, ondesuhd, …)
```

All of the above return live data (25 ongoing titles, 6 pages) — the scrape is
per-request, so **new episodes and ongoing/completed lists update automatically
with the source site** (no local mirror or cron needed; the backend caches each
response for `WAJIK_CACHE_TTL` seconds).
