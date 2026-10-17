/**
 * Probe: bisakah browser sungguhan (Chromium) mengambil berkas media dari
 * provider embed film? Kalau ya, proxy kita bisa memakai cookie + UA yang sama
 * (IP sama) sehingga nobar film tetap bisa disinkronkan seperti anime.
 *
 * Jalankan: node scripts/film-media-probe.js
 */
const puppeteer = require(require.resolve("puppeteer", {
  paths: ["/home/ubuntu/nobar-king-akbar-anime/anime1v-api/node_modules"],
}));

const TARGET = process.env.PROBE_URL || "https://vidlink.pro/movie/94329";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--mute-audio",
    ],
  });

  const mediaUrls = new Set();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1280, height: 720 });
    page.on("response", (response) => {
      const url = response.url();
      if (/\.mp4|\.m3u8|videoplayback|master\.m3u8/i.test(url)) {
        mediaUrls.add(url);
        console.log(`[net] ${response.status()} ${url.slice(0, 120)}`);
      }
    });

    console.log(`[open] ${TARGET}`);
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((error) => {
      console.log(`[warn] ${String(error.message).split("\n")[0]}`);
    });

    // Tunggu sampai ada jejak media (maks ~40 detik) lalu coba putar.
    for (let attempt = 0; attempt < 20 && mediaUrls.size === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await page.evaluate(() => {
        const video = document.querySelector("video");
        if (video) {
          video.muted = true;
          video.play().catch(() => undefined);
        }
        document.querySelectorAll("button").forEach((button) => {
          if (/play/i.test(button.textContent || "")) button.click();
        });
      });
    }

    const mediaUrl = Array.from(mediaUrls)[0] ?? null;
    console.log(`[media] ditemukan: ${mediaUrl ? mediaUrl.slice(0, 140) : "(tidak ada)"}`);

    if (!mediaUrl) {
      console.log("STATUS: GAGAL - browser tidak memuat media dari provider ini");
      return;
    }

    // Uji: apakah fetch dari dalam halaman (dengan cookie + UA browser) lolos?
    const result = await page.evaluate(async (target) => {
      try {
        const response = await fetch(target, {
          headers: { Range: "bytes=0-2048" },
          credentials: "include",
        });
        const buffer = await response.arrayBuffer();
        return { status: response.status, type: response.headers.get("content-type"), bytes: buffer.byteLength };
      } catch (error) {
        return { status: 0, type: String(error).slice(0, 120), bytes: 0 };
      }
    }, mediaUrl);

    console.log(`[fetch di halaman] status=${result.status} type=${result.type} bytes=${result.bytes}`);

    // Uji kedua: pakai konteks request browser (membawa cookie) ke URL media.
    const cookies = await page.cookies(mediaUrl).catch(() => []);
    console.log(`[cookie] ${cookies.map((cookie) => cookie.name).join(", ") || "(tidak ada)"}`);

    console.log(
      result.status === 200 || result.status === 206
        ? "STATUS: LOLOS - media bisa diambil browser; proxy cookie+UA mungkin bisa dipakai (sync film memungkinkan)"
        : "STATUS: TERTAHAN - media hanya bisa diputar di dalam player provider (nobar film = mode sinema, tanpa sync otomatis)"
    );
  } finally {
    await browser.close().catch(() => undefined);
  }
})().catch((error) => {
  console.log("GAGAL:", String(error.message).split("\n")[0]);
});
