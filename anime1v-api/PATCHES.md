# PATCHES — anime1v-api (vendored, modified)

This project vendors [FxxMorgan/anime1v-api](https://github.com/FxxMorgan/anime1v-api)
(MIT) and applies a small set of patches needed by **Nobar King Akbar Anime**.
Everything here is documented so the diff against upstream is clear.

> **Peran saat ini:** katalog tidak lagi diambil dari sini. Sejak sumber konten berpindah ke
> [`wajik-anime-api`](../wajik-anime-api/PATCHES.md) (otakudesu, sub Indo), layanan ini dipakai
> **hanya sebagai mesin resolver** — endpoint `/resolve` yang mengubah URL embed player
> (`desustream`, `vidhide`, …) menjadi URL media langsung (MP4/HLS) dengan Puppeteer.

## 1. New: `src/utils/resolvers/zilla.resolver.js`

Zilla Networks (`player.zilla-networks.com`) is the fastest HLS source for most
episodes, but it builds its master playlist in the browser (obfuscated JS +
`sec-fetch-*` checks), so plain HTTP scraping returns nothing.

The new resolver drives the player page with Puppeteer, sniffs network
responses for `*.m3u8` requests, and returns the first valid master playlist URL.

## 2. `src/utils/resolvers.js`

- dispatch `zilla` / `zilla-networks` player URLs to the new resolver;
- relaxed the request-interception rule that blocked all `script` resources
  (the Zilla player requires its own scripts to run);
- safer `page.goto` handling (waitUntil `domcontentloaded`, longer timeout,
  graceful fallback when the navigation "fails" after the player already booted).

## 3. `src/utils/http.js`

`isLikelyVideoUrl()` now rejects obvious static-asset extensions
(`.jpg .png .css .js .svg .woff …`) so embedded links are not misclassified
as playable streams.

## 4. `src/services/animeav1.service.js`

- link classification: each episode link is now classified as
  `stream` (resolvable player), `embed` (iframe-only player) or `download`
  (direct file), instead of assuming everything is a stream;
- episode payload gains explicit `embeds` / `downloads` buckets;
- catalog passes the source `status` field through untouched (the source
  does not always populate it — we keep `null` rather than inventing values).

## 5. `src/routes/anime.routes.js`

- `/catalog` accepts and forwards the `status` filter;
- `/resolve` detects `mediaType` (`hls` / `mp4`) and echoes the requested
  `server`, so the backend can label sources precisely.

## 6. New: `src/utils/resolvers/desustream.resolver.js`

`desustream.*` (server `odcdn` / `odstream` / `ondesuhd` pada sumber otakudesu) menyimpan URL MP4
pada properti `file:` di dalam halaman embed. Resolver baru ini membuka halaman embed dengan
Puppeteer, menunggu iframe/inline player, mengekstrak URL media (termasuk varian base64/URL-encoded),
dan mengembalikan MP4 langsung (contoh: `https://cdn.odcloud.net/anime/...mp4`, 720p, mendukung
HTTP Range). Dispatch untuk pola `desustream\.` ditambahkan di `src/utils/resolvers.js`.

## Verification

The patched service is exercised live by the backend (`RESOLVER_API_URL`) whenever an episode is
played:

```bash
curl -H "X-API-Key: nobar-internal-dev-key" \
  "http://localhost:4100/api/v1/anime/resolve?url=<EMBED_URL>&server=desustream"
```

returns `{ "url": "https://cdn.odcloud.net/anime/....mp4", "mediaType": "mp4", ... }` — the backend
then serves those bytes through its own signed `/api/stream/proxy` (the CDN sends no CORS headers).
