/* ============================================================================
 *  UJI LANJUTAN — Sumber mana yang bisa diakses dari IP panel ini?
 *
 *  Menjawab: dari 4 sumber sub-Indo (otakudesu, oploverz, samehadaku,
 *  kuramanime) + CDN playback + host pendukung, mana yang TIDAK diblokir
 *  Cloudflare, dan apakah UDP keluar container (syarat jalur WARP).
 *
 *  Pakai:
 *      node panel-test/test2.js            (uji biasa)
 *      WARP=1 node panel-test/test2.js     (sekalian uji jalur WARP)
 * ========================================================================== */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const dgram = require("node:dgram");
const zlib = require("node:zlib");
const http = require("node:https");
const { spawnSync, spawn } = require("node:child_process");

const WORK_DIR = __dirname;
const REPORT_PATHS = [path.join(process.cwd(), "panel-test-result.txt"), path.join(WORK_DIR, "panel-test-result-2.txt")];
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

const TARGETS = [
  ["otakudesu.blog", "https://otakudesu.blog/", true],
  ["oploverz.am", "https://oploverz.am/", true],
  ["v1.samehadaku.how", "https://v1.samehadaku.how/", true],
  ["kuramanime.ing", "https://kuramanime.ing/", true],
  ["cdn.odcloud.net", "https://cdn.odcloud.net/", false],
  ["github.com", "https://github.com/", false],
  ["files.manuscdn.com", "https://files.manuscdn.com/", false],
  ["api.cloudflareclient.com", "https://api.cloudflareclient.com/", false],
];

const BLOCK = /just a moment|attention required|checking your browser|cf-browser-verification|you have been blocked/i;

function titleOf(html) {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html || "");
  return match ? match[1].trim().slice(0, 60) : "(tanpa judul)";
}

function dnsQuery(name) {
  const bytes = [0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  for (const part of name.split(".")) {
    bytes.push(part.length, ...Buffer.from(part, "ascii"));
  }
  bytes.push(0x00, 0x00, 0x01, 0x00, 0x01);
  return Buffer.from(bytes);
}

function udpProbe(host, port, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;
    const done = (ok, info) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        /* abaikan */
      }
      resolve({ ok, info });
    };
    socket.on("message", (message) => done(true, message.length + " byte"));
    socket.on("error", (error) => done(false, error.message));
    socket.send(dnsQuery("cloudflare.com"), port, host, (error) => {
      if (error) done(false, error.message);
    });
    setTimeout(() => done(false, "timeout"), timeoutMs);
  });
}

function extractZip(zipPath, outDir) {
  const buffer = fs.readFileSync(zipPath);
  let eocd = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("struktur zip tidak dikenali");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const written = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? raw : zlib.inflateRawSync(raw);
    const target = path.join(outDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    if (!name.endsWith("/")) fs.chmodSync(target, 0o755);
    written.push(name);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return written;
}

function download(url, target) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { "User-Agent": UA } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        download(response.headers.location, target).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error("HTTP " + response.statusCode));
        return;
      }
      const stream = fs.createWriteStream(target);
      response.pipe(stream);
      stream.on("finish", () => {
        stream.close();
        resolve(fs.statSync(target).size);
      });
    });
    request.on("error", reject);
    request.setTimeout(120000, () => request.destroy(new Error("timeout unduh")));
  });
}

(async () => {
  section("1. Lingkungan");
  log("waktu     : " + new Date().toISOString());
  log("node      : " + process.version + " | RAM bebas: " + Math.round(os.freemem() / 1024 / 1024) + " MB");

  section("2. Probe HTTP langsung (tanpa browser)");
  for (const [name, url] of TARGETS) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });
      const body = await response.text();
      const blocked = BLOCK.test(body.slice(0, 4000)) || BLOCK.test(titleOf(body));
      log(
        name.padEnd(24) +
          ": HTTP " +
          response.status +
          " | " +
          body.length +
          " char | " +
          (blocked ? "DIBLOKIR" : "judul: " + titleOf(body))
      );
    } catch (error) {
      log(name.padEnd(24) + ": GAGAL (" + String(error.message).split("\n")[0].slice(0, 60) + ")");
    }
  }

  section("3. Probe UDP (syarat jalur WARP)");
  for (const [host, port] of [
    ["1.1.1.1", 53],
    ["8.8.8.8", 53],
  ]) {
    const result = await udpProbe(host, port);
    log("DNS " + host + ":" + port + "   : " + (result.ok ? "OK (" + result.info + ")" : "GAGAL (" + result.info + ")"));
  }

  section("4. Probe browser (Chromium) — deteksi Cloudflare");
  let puppeteer;
  try {
    puppeteer = require(path.join(WORK_DIR, "node_modules", "puppeteer"));
  } catch {
    try {
      puppeteer = require("puppeteer");
    } catch {
      log("puppeteer tidak ditemukan — jalankan uji pertama dulu (test.js)");
      return;
    }
  }

  const browserArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--mute-audio",
  ];

  const usable = [];
  const browser = await puppeteer.launch({ headless: true, args: browserArgs });
  try {
    for (const [name, url, isSource] of TARGETS) {
      const page = await browser.newPage();
      await page.setUserAgent(UA);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        let title = await page.title();
        for (let attempt = 0; attempt < 8 && BLOCK.test(title); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          title = await page.title();
        }
        const html = await page.content();
        const blocked = BLOCK.test(title);
        log(
          name.padEnd(24) + ": " + (blocked ? "TERTAHAN" : "LOLOS") + " | " + html.length + " char | " + title.slice(0, 50)
        );
        if (!blocked && html.length > 2000 && isSource) usable.push(name);
      } catch (error) {
        log(name.padEnd(24) + ": ERROR (" + String(error.message).split("\n")[0].slice(0, 60) + ")");
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  section("5. Kesimpulan sementara");
  if (usable.length) {
    log("sumber yang bisa dipakai dari panel ini: " + usable.join(", "));
  } else {
    log("TIDAK ada sumber sub-Indo yang bisa diakses langsung dari IP panel ini.");
  }

  if (process.env.WARP === "1") {
    section("6. Uji jalur WARP (proxy SOCKS5)");
    const zipPath = path.join(WORK_DIR, "warp-plus.zip");
    const binDir = path.join(WORK_DIR, "warp");
    try {
      log("mengunduh warp-plus…");
      const size = await download(
        "https://github.com/bepass-org/warp-plus/releases/download/v1.2.6/warp-plus_linux-amd64.zip",
        zipPath
      );
      log("unduh     : " + Math.round(size / 1024) + " KB");
      const files = extractZip(zipPath, binDir);
      log("diekstrak : " + files.join(", "));
      const binary = path.join(binDir, files.find((file) => !file.endsWith("/")) || "warp-plus");
      const child = spawn(binary, ["-b", "127.0.0.1:1080"], { cwd: binDir, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (chunk) => log("[warp] " + String(chunk).trim().slice(0, 160)));
      child.stderr.on("data", (chunk) => log("[warp] " + String(chunk).trim().slice(0, 160)));
      log("menunggu proxy siap (12 detik)…");
      await new Promise((resolve) => setTimeout(resolve, 12000));

      const proxyBrowser = await puppeteer.launch({
        headless: true,
        args: [...browserArgs, "--proxy-server=socks5://127.0.0.1:1080"],
      });
      try {
        for (const [name, url, isSource] of TARGETS.filter((item) => item[2])) {
          const page = await proxyBrowser.newPage();
          await page.setUserAgent(UA);
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
            let title = await page.title();
            for (let attempt = 0; attempt < 8 && BLOCK.test(title); attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 2500));
              title = await page.title();
            }
            const html = await page.content();
            const blocked = BLOCK.test(title);
            log(
              "[warp] " + name.padEnd(20) + ": " + (blocked ? "TERTAHAN" : "LOLOS") + " | " + html.length + " char | " + title.slice(0, 40)
            );
            if (!blocked && html.length > 2000 && isSource) usable.push(name + " (via WARP)");
          } catch (error) {
            log("[warp] " + name.padEnd(20) + ": ERROR (" + String(error.message).split("\n")[0].slice(0, 50) + ")");
          } finally {
            await page.close().catch(() => undefined);
          }
        }
      } finally {
        await proxyBrowser.close().catch(() => undefined);
        child.kill("SIGKILL");
      }
    } catch (error) {
      log("WARP gagal: " + String(error.message).split("\n")[0]);
    }
  }

  log("");
  log(
    "STATUS: " +
      (usable.length ? "LOLOS - sumber tersedia: " + usable.join(", ") : "SEBAGIAN - belum ada sumber yang bisa diakses dari panel")
  );
  log("");
  log("Laporan tersimpan di: panel-test-result.txt");
})().catch((error) => {
  log("GAGAL: " + String(error.message).split("\n")[0]);
});
