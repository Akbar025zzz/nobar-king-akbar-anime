/* Uji kelayakan Pterodactyl: bisakah Chromium hidup di container panel,
 * dan bisakah ia melewati Cloudflare otakudesu (sumber konten)?
 *
 * Jalankan di server panel:  npm install && npm test
 * Hasil juga ditulis ke panel-test-result.txt (bisa dibaca dari file manager / API).
 */
const os = require("node:os");
const fs = require("node:fs");

const LOG_FILE = process.env.RESULT_FILE || "panel-test-result.txt";
const lines = [];

function log(text) {
  const value = String(text);
  console.log(value);
  lines.push(value);
  try {
    fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
  } catch {
    /* file manager read-only: abaikan */
  }
}

function section(title) {
  log("");
  log("=== " + title + " ===");
}

function finish(status, detail) {
  log("");
  log("STATUS: " + status + (detail ? " - " + detail : ""));
  process.exit(status === "LOLOS" ? 0 : 1);
}

(async () => {
  section("1. Lingkungan container");
  log("node      : " + process.version);
  log("platform  : " + process.platform + " " + process.arch);
  log("CPU       : " + os.cpus().length + " core");
  log("RAM total : " + Math.round(os.totalmem() / 1024 / 1024) + " MB");
  log("RAM free  : " + Math.round(os.freemem() / 1024 / 1024) + " MB");
  log("cwd       : " + process.cwd());
  try {
    const stat = fs.statfsSync(process.cwd());
    log("disk free : " + ((stat.bavail * stat.bsize) / 1024 ** 3).toFixed(1) + " GB");
  } catch {
    /* opsional */
  }

  section("2. Launch Chromium (puppeteer)");
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (error) {
    finish("GAGAL", "puppeteer belum terpasang (jalankan npm install)");
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    log("browser   : " + (await browser.version()));
  } catch (error) {
    log("pesan     : " + String(error.message).split("\n").slice(0, 6).join(" | "));
    finish("GAGAL", "Chromium tidak bisa jalan di container ini");
    return;
  }

  section("3. Buka otakudesu (uji Cloudflare)");
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    );
    await page.goto("https://otakudesu.blog/", { waitUntil: "domcontentloaded", timeout: 60000 });
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
    log("judul     : " + title);
    log("HTML      : " + html.length + " karakter");
    const blocked = /just a moment|checking your browser|attention required/i.test(title);
    log("cloudflare: " + (blocked ? "TERTAHAN" : "LOLOS"));

    section("4. Uji cepat endpoint sumber");
    const response = await page.evaluate(async () => {
      const res = await fetch("https://otakudesu.blog/ongoing-anime/", { credentials: "include" });
      const text = await res.text();
      return { status: res.status, length: text.length };
    });
    log("ongoing   : HTTP " + response.status + " (" + response.length + " karakter)");

    if (!blocked && html.length > 2000 && response.status === 200) {
      finish("LOLOS", "panel ini bisa menjalankan scraper sumber konten");
    } else {
      finish("SEBAGIAN", "Chromium hidup, tetapi Cloudflare/endpoint belum lolos");
    }
  } catch (error) {
    log("pesan     : " + String(error.message).split("\n")[0]);
    finish("SEBAGIAN", "Chromium hidup, tetapi halaman gagal dimuat");
  } finally {
    await browser.close().catch(() => undefined);
  }
})().catch((error) => {
  log("GAGAL: " + String(error.message).split("\n")[0]);
  finish("GAGAL", "kesalahan tak terduga");
});
