/* ============================================================================
 *  UJI PLAYBACK DARI PANEL — bisakah Chromium panel memecahkan embed upbolt
 *  (sumber streaming oploverz) sampai ke playlist HLS-nya?
 *
 *  Pakai:  node panel-test/test3.js
 * ========================================================================== */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const WORK_DIR = __dirname;
const REPORT_PATHS = [path.join(process.cwd(), "panel-test-result-3.txt"), path.join(WORK_DIR, "panel-test-result-3.txt")];
const lines = [];

function log(text) {
  const value = String(text);
  console.log(value);
  lines.push(value);
  for (const target of REPORT_PATHS) {
    try {
      fs.writeFileSync(target, lines.join("\n") + "\n");
    } catch {
      /* abaikan */
    }
  }
}

function section(title) {
  log("");
  log("=== " + title + " ===");
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const EPISODE_PAGE = "https://oploverz.am/jojos-bizarre-adventure-6-steel-ball-run-episode-05-subtitle-indonesia/";
const FALLBACK_EMBED = "https://upbolt.to/e/tsjpa9jb6678";

(async () => {
  section("1. Lingkungan");
  log("waktu     : " + new Date().toISOString());
  log("node      : " + process.version + " | RAM bebas: " + Math.round(os.freemem() / 1024 / 1024) + " MB");

  section("2. Cari URL embed dari halaman episode oploverz");
  let embedUrl = null;
  try {
    const response = await fetch(EPISODE_PAGE, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
      signal: AbortSignal.timeout(30000),
    });
    const html = await response.text();
    log("halaman   : HTTP " + response.status + " (" + html.length + " char)");
    const match = /https:\/\/upbolt\.to\/e\/[a-z0-9]+/i.exec(html) || /upbolt\.to[^"'\s]*/i.exec(html);
    if (match) {
      embedUrl = match[0].startsWith("http") ? match[0] : "https://" + match[0];
      log("embed     : " + embedUrl);
    } else {
      log("embed     : tidak ditemukan di HTML → pakai contoh tetap");
    }
  } catch (error) {
    log("halaman   : gagal (" + String(error.message).split("\n")[0].slice(0, 60) + ")");
  }
  if (!embedUrl) embedUrl = FALLBACK_EMBED;

  section("3. Buka embed di Chromium & ekstrak media");
  let puppeteer;
  try {
    puppeteer = require(path.join(WORK_DIR, "node_modules", "puppeteer"));
  } catch {
    try {
      puppeteer = require("puppeteer");
    } catch {
      log("puppeteer tidak ditemukan — jalankan test.js dulu");
      return;
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--mute-audio",
    ],
  });

  const mediaUrls = new Set();
  let playlistText = "";
  let segmentOk = false;

  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    page.on("request", (request) => {
      const url = request.url();
      if (/\.m3u8|\.mp4|videoplayback|master\.m3u8/i.test(url)) mediaUrls.add(url);
    });
    page.on("response", (response) => {
      const url = response.url();
      if (/\.m3u8/i.test(url)) mediaUrls.add(url);
    });

    log("membuka   : " + embedUrl);
    await page
      .goto(embedUrl, { waitUntil: "domcontentloaded", timeout: 60000 })
      .catch((error) => log("catatan   : " + String(error.message).split("\n")[0].slice(0, 80)));
    // Tunggu tantangan Cloudflare selesai (judul kosong/"Just a moment"/"Attention Required").
    let title = "";
    for (let attempt = 0; attempt < 24; attempt += 1) {
      title = await page.title().catch(() => "");
      const waiting = !title || /just a moment|attention required|checking your browser/i.test(title);
      if (!waiting) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    await new Promise((resolve) => setTimeout(resolve, 6000));
    log("judul     : " + (title || "(kosong)").slice(0, 60));
    log("request   : " + mediaUrls.size + " kandidat media sejauh ini");

    // Cari jejak media di HTML & video element
    const found = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const urls = [];
      const pattern = /https?:\/\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/gi;
      let match;
      while ((match = pattern.exec(html)) !== null) urls.push(match[0]);
      const video = document.querySelector("video");
      if (video?.src) urls.push(video.src);
      for (const source of Array.from(document.querySelectorAll("source"))) {
        if (source.src) urls.push(source.src);
      }
      const iframes = Array.from(document.querySelectorAll("iframe")).map((frame) => frame.src).filter(Boolean);
      return { urls: Array.from(new Set(urls)).slice(0, 10), iframes: iframes.slice(0, 5), htmlLength: html.length };
    });

    for (const url of found.urls) mediaUrls.add(url);
    log("HTML      : " + found.htmlLength + " char | iframe: " + found.iframes.length);
    for (const url of found.iframes) log("iframe    : " + url.slice(0, 100));

    section("4. Media yang ditemukan");
    if (!mediaUrls.size) {
      log("(tidak ada .m3u8/.mp4 terdeteksi)");
    }
    for (const url of Array.from(mediaUrls).slice(0, 6)) log("- " + url.slice(0, 150));

    const hlsUrl = Array.from(mediaUrls).find((url) => /\.m3u8/i.test(url));
    if (hlsUrl) {
      section("5. Uji playlist HLS");
      const result = await page.evaluate(async (target) => {
        try {
          const response = await fetch(target, { credentials: "include" });
          const text = await response.text();
          return { status: response.status, head: text.slice(0, 400), length: text.length };
        } catch (error) {
          return { status: 0, head: String(error).slice(0, 200), length: 0 };
        }
      }, hlsUrl);
      log("playlist  : HTTP " + result.status + " (" + result.length + " char)");
      log(result.head.split("\n").slice(0, 6).join("\n"));
      playlistText = result.head;

      const variantUrl = /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/.exec(result.head)?.[1];
      const mediaListUrl = variantUrl || (/\.m3u8/.test(result.head) ? hlsUrl : null);
      if (mediaListUrl) {
        const segments = await page.evaluate(async (target) => {
          try {
            const response = await fetch(target, { credentials: "include" });
            const text = await response.text();
            const lines = text.split("\n").filter((row) => row && !row.startsWith("#"));
            return { status: response.status, first: lines.slice(0, 2), count: lines.length };
          } catch (error) {
            return { status: 0, first: [], count: 0 };
          }
        }, mediaListUrl);
        log("segmen    : HTTP " + segments.status + " | " + segments.count + " baris");
        if (segments.count) segmentOk = true;
      }
    }
  } catch (error) {
    log("ERROR     : " + String(error.message).split("\n")[0].slice(0, 100));
  } finally {
    await browser.close().catch(() => undefined);
  }

  log("");
  if (mediaUrls.size && segmentOk) {
    log("STATUS: LOLOS - embed upbolt bisa dipecahkan dari panel ini dan playlist HLS terbaca");
  } else if (mediaUrls.size) {
    log("STATUS: SEBAGIAN - media terdeteksi tapi playlist/segmen belum terverifikasi");
  } else {
    log("STATUS: GAGAL - embed tidak bisa dipecahkan dari panel (playback tidak akan jalan)");
  }
  log("");
  log("Laporan tersimpan di: panel-test-result-3.txt");
})().catch((error) => {
  log("GAGAL: " + String(error.message).split("\n")[0]);
});
