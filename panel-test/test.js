/* ============================================================================
 *  UJI KELAYAKAN PANEL — Nobar King Akbar Anime
 *  Menjawab satu pertanyaan: bisakah Chromium hidup di container ini dan
 *  melewati Cloudflare otakudesu (sumber konten sub-Indo)?
 *
 *  Cara pakai (lihat PANDUAN.txt):
 *      node panel-test/test.js
 *
 *  Skrip ini mengurus semuanya sendiri: memasang puppeteer + Chromium,
 *  menjalankan uji, lalu menulis laporan ke panel-test-result.txt.
 * ========================================================================== */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const WORK_DIR = __dirname;
const REPORT_PATHS = [path.join(process.cwd(), "panel-test-result.txt"), path.join(WORK_DIR, "panel-test-result.txt")];
const lines = [];

function log(text) {
  const value = String(text);
  console.log(value);
  lines.push(value);
  for (const target of REPORT_PATHS) {
    try {
      fs.writeFileSync(target, lines.join("\n") + "\n");
    } catch {
      /* abaikan bila tidak punya izin */
    }
  }
}

function section(title) {
  log("");
  log("=== " + title + " ===");
}

function finish(status, detail) {
  log("");
  log("STATUS: " + status + (detail ? " - " + detail : ""));
  log("");
  log("Laporan juga tersimpan di: panel-test-result.txt");
  process.exit(0);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: WORK_DIR,
    stdio: "inherit",
    timeout: 900000,
    ...options,
  });
}

function ensurePuppeteer() {
  try {
    return require("puppeteer");
  } catch {
    log("puppeteer : belum ada → memasang ke folder skrip (1–3 menit)…");
    const result = run("npm", ["install", "--no-audit", "--no-fund", "--prefix", WORK_DIR, "puppeteer@24.43.1"]);
    log("pemasangan: selesai (status " + result.status + ")");
    return require(path.join(WORK_DIR, "node_modules", "puppeteer"));
  }
}

function memoryLimit() {
  for (const file of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    try {
      const raw = fs.readFileSync(file, "utf8").trim();
      if (raw && raw !== "max" && Number(raw) > 0) {
        return Math.round(Number(raw) / 1024 / 1024) + " MB";
      }
    } catch {
      /* lanjut */
    }
  }
  return "tidak terdeteksi";
}

(async () => {
  section("1. Lingkungan container");
  log("waktu     : " + new Date().toISOString());
  log("node      : " + process.version);
  log("platform  : " + process.platform + " " + process.arch);
  log("CPU       : " + os.cpus().length + " core");
  log("RAM total : " + Math.round(os.totalmem() / 1024 / 1024) + " MB");
  log("RAM bebas : " + Math.round(os.freemem() / 1024 / 1024) + " MB");
  log("cgroup    : " + memoryLimit());
  log("folder    : " + process.cwd());
  log("skrip     : " + WORK_DIR);

  section("2. Pasang & luncurkan Chromium");
  let puppeteer;
  try {
    puppeteer = ensurePuppeteer();
    log("puppeteer : " + require(path.join(WORK_DIR, "node_modules", "puppeteer", "package.json")).version);
  } catch (error) {
    log("pesan     : " + String(error.message).split("\n")[0]);
    finish("GAGAL", "puppeteer tidak bisa dipasang (cek koneksi keluar container)");
    return;
  }

  let chromePath = "";
  try {
    chromePath = puppeteer.executablePath();
    if (!fs.existsSync(chromePath)) {
      log("chrome    : belum ada → mengunduh (1–3 menit)…");
      const result = run("npx", ["--yes", "puppeteer", "browsers", "install", "chrome"]);
      log("unduh     : selesai (status " + result.status + ")");
      chromePath = puppeteer.executablePath();
    }
    log("chrome    : " + chromePath);
    log("ukuran    : " + (fs.existsSync(chromePath) ? Math.round(fs.statSync(chromePath).size / 1024 / 1024) + " MB" : "tidak ada"));
  } catch (error) {
    log("unduh     : gagal - " + error.message);
  }

  let browser;
  const launchStart = Date.now();
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-sync",
        "--disable-default-apps",
        "--mute-audio",
        "--no-first-run",
        "--disable-blink-features=AutomationControlled",
        "--renderer-process-limit=1",
      ],
    });
    log("browser   : " + (await browser.version()));
    log("launch    : " + Math.round((Date.now() - launchStart) / 1000) + " detik");
  } catch (error) {
    log("pesan     : " + String(error.message).split("\n").slice(0, 8).join(" | "));

    // Diagnosa: library sistem yang hilang (penyebab paling umum).
    if (chromePath && fs.existsSync(chromePath)) {
      log("");
      log("--- diagnosa library (ldd | not found) ---");
      const ldd = spawnSync("ldd", [chromePath], { encoding: "utf8", timeout: 60000 });
      const missing = String(ldd.stdout || "")
        .split("\n")
        .filter((row) => row.includes("not found"))
        .map((row) => row.trim().split(" ")[0]);
      if (missing.length) {
        log("library hilang (" + missing.length + "):");
        for (const name of missing) log("  - " + name);
        log("catatan   : ini penyebab Chromium gagal; butuh root untuk memasangnya.");
      } else {
        log("(tidak ada library yang hilang — penyebabnya kemungkinan memori/kebijakan container)");
      }
      log("--- akhir diagnosa ---");
    }
    finish("GAGAL", "Chromium tidak bisa dijalankan di container ini");
    return;
  }

  section("3. Uji sumber konten (Cloudflare otakudesu)");
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    );
    const gotoStart = Date.now();
    await page.goto("https://otakudesu.blog/", { waitUntil: "domcontentloaded", timeout: 90000 });
    let title = await page.title();
    for (
      let attempt = 0;
      attempt < 10 && /just a moment|checking your browser|attention required/i.test(title);
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      title = await page.title();
    }
    const html = await page.content();
    const blocked = /just a moment|checking your browser|attention required/i.test(title);
    log("judul     : " + title);
    log("HTML      : " + html.length + " karakter");
    log("muat      : " + Math.round((Date.now() - gotoStart) / 1000) + " detik");
    log("cloudflare: " + (blocked ? "TERTAHAN" : "LOLOS"));

    section("4. Uji endpoint daftar anime");
    const response = await page.evaluate(async () => {
      const res = await fetch("https://otakudesu.blog/ongoing-anime/", { credentials: "include" });
      const text = await res.text();
      return { status: res.status, length: text.length };
    });
    log("ongoing   : HTTP " + response.status + " (" + response.length + " karakter)");

    if (!blocked && html.length > 2000 && response.status === 200) {
      finish("LOLOS", "panel bisa menjalankan scraper sumber konten");
    } else {
      finish("SEBAGIAN", "Chromium hidup, tapi Cloudflare/endpoint belum lolos dari IP panel");
    }
  } catch (error) {
    log("pesan     : " + String(error.message).split("\n")[0]);
    finish("SEBAGIAN", "Chromium hidup, tapi halaman sumber gagal dimuat");
  } finally {
    await browser.close().catch(() => undefined);
  }
})().catch((error) => {
  log("GAGAL: " + String(error.message).split("\n")[0]);
  finish("GAGAL", "kesalahan tak terduga");
});
