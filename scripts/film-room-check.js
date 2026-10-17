/*
 * Verifikasi room nobar FILM (mode sinema):
 *  - dua akun nyata (host + peserta) lewat UI
 *  - host membuat room dari pencarian gabungan anime+film
 *  - host menekan "Mulai Bareng" → hitung mundur tampil di host & peserta, iframe dimuat ulang
 *  - chat realtime tetap jalan
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require(require.resolve("puppeteer", {
  paths: [path.join(__dirname, "..", "anime1v-api")],
}));

const BASE = process.env.E2E_BASE || "https://3000-irhefyuqda4fhazi9n5r4-24916fab.sg2.manus.computer";
const SHOT = "/home/ubuntu/nobar-king-akbar-anime/docs/screenshots";
const stamp = Date.now().toString().slice(-7);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT, name) });
  console.log("SHOT", name);
}

async function register(page, username, email) {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.type("#username", username);
  await page.type("#email", email);
  await page.type("#password", "rahasia12345");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await sleep(1500);
}

async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, needle) =>
      Array.from(document.querySelectorAll(sel)).find((el) =>
        (el.textContent || "").toLowerCase().includes(needle.toLowerCase()),
      ),
    selector,
    text,
  );
  const element = handle.asElement();
  if (!element) throw new Error(`Tidak menemukan ${selector} dengan teks "${text}"`);
  await element.click();
  return element;
}

async function readCinema(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const overlay = Array.from(document.querySelectorAll("p")).find(
      (p) => (p.textContent || "").trim().toLowerCase() === "mulai bareng",
    );
    const digit = overlay ? overlay.parentElement.querySelectorAll("p")[1] : null;
    const frame = document.querySelector("iframe");
    return {
      overlay: Boolean(overlay),
      digit: digit ? (digit.textContent || "").trim() : null,
      iframeSrc: frame ? frame.getAttribute("src") : null,
      hasChat: Boolean(document.querySelector('textarea[placeholder], input[placeholder*="pesan"]')),
      hasCountdownNote: /setelah hitungan selesai/i.test(text),
    };
  });
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,980"],
  });
  const hostCtx = await browser.createBrowserContext();
  const guestCtx = await browser.createBrowserContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  await host.setViewport({ width: 1440, height: 980 });
  await guest.setViewport({ width: 1440, height: 980 });
  const errors = [];
  host.on("pageerror", (e) => errors.push(`host: ${String(e).slice(0, 160)}`));
  guest.on("pageerror", (e) => errors.push(`guest: ${String(e).slice(0, 160)}`));

  console.log("== 1. daftar host & peserta ==");
  await register(host, `hostfilm${stamp}`, `hostfilm${stamp}@contoh.test`);
  await register(guest, `tamufilm${stamp}`, `tamufilm${stamp}@contoh.test`);

  console.log("== 2. host membuat room dari film ==");
  await host.goto(`${BASE}/nobar/create`, { waitUntil: "networkidle2", timeout: 120000 });
  const searchInput = 'input[placeholder*="Cari anime atau film"]';
  await host.waitForSelector(searchInput, { timeout: 30000 });
  await host.type(searchInput, "the raid", { delay: 60 });
  await sleep(3500);
  const results = await host.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => (b.textContent || "").trim())
      .filter((t) => /raid/i.test(t))
      .slice(0, 6),
  );
  console.log("hasil pencarian:", JSON.stringify(results));
  await shot(host, "33-film-create-search.png");
  await clickByText(host, "button", "The Raid");
  await sleep(3000);
  const form = await host.evaluate(() => {
    const text = document.body.innerText;
    return {
      confirmStep: /Konfirmasi Judul/i.test(text),
      hasRoomName: Boolean(document.querySelector("#roomName")),
      episodeOptions: Array.from(document.querySelectorAll("button"))
        .map((b) => (b.textContent || "").trim())
        .filter((t) => /^Film tunggal$|^Episode \d+$/i.test(t)),
    };
  });
  console.log("form:", JSON.stringify(form));
  await shot(host, "34-film-create-form.png");
  await Promise.all([
    host.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
    clickByText(host, "button", "Buat Room & Mulai Nobar"),
  ]);
  await sleep(3500);
  const roomUrl = host.url();
  console.log("room URL:", roomUrl);

  console.log("== 3. peserta bergabung ==");
  await guest.goto(roomUrl, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(4000);
  const guestBefore = await readCinema(guest);
  console.log("peserta sebelum mulai:", JSON.stringify(guestBefore));
  await shot(host, "35-film-room-host.png");
  await shot(guest, "36-film-room-guest.png");

  console.log("== 4. host menekan Mulai Bareng ==");
  const clicked = await host.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((b) =>
      /mulai bareng/i.test(b.textContent || ""),
    );
    if (!button) return false;
    button.click();
    return true;
  });
  console.log("tombol diklik:", clicked);
  await sleep(700);
  const hostCount = await readCinema(host);
  const guestCount = await readCinema(guest);
  console.log("host countdown:", JSON.stringify(hostCount));
  console.log("peserta countdown:", JSON.stringify(guestCount));
  await shot(host, "37-film-room-countdown-host.png");
  await shot(guest, "38-film-room-countdown-guest.png");

  await sleep(4500);
  const hostAfter = await readCinema(host);
  const guestAfter = await readCinema(guest);
  console.log("host setelah hitung mundur:", JSON.stringify(hostAfter));
  console.log("peserta setelah hitung mundur:", JSON.stringify(guestAfter));

  console.log("== 5. chat realtime ==");
  const chatSel = 'textarea[placeholder*="pesan"], input[placeholder*="pesan"]';
  await guest.waitForSelector(chatSel, { timeout: 20000 });
  await guest.type(chatSel, `Siap nonton bareng ${stamp}`);
  await guest.keyboard.press("Enter");
  await sleep(2500);
  const chatOnHost = await host.evaluate(() => /Siap nonton bareng/.test(document.body.innerText));
  console.log("pesan peserta terlihat di host:", chatOnHost);
  await shot(host, "39-film-room-chat-host.png");

  console.log("ERRORS:", errors.length ? JSON.stringify(errors.slice(0, 6)) : "none");
  console.log("ROOM_ID:", roomUrl.split("/").pop());
  await browser.close();
}

main().catch((error) => {
  console.error("FATAL", error);
  process.exit(1);
});
