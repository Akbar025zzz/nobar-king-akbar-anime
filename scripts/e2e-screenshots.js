/* E2E visual walkthrough of Nobar King Akbar Anime via the public gateway URL */
const fs = require("fs");
const path = require("path");
// puppeteer is installed with the vendored anime1v-api (npm install there).
const puppeteer = require(require.resolve("puppeteer", {
  paths: [path.join(__dirname, "..", "anime1v-api")],
}));

const BASE = process.env.E2E_BASE || "https://3000-irhefyuqda4fhazi9n5r4-24916fab.sg2.manus.computer";
const SHOT = "/home/ubuntu/nobar-king-akbar-anime/docs/screenshots";
const CONTENT_ID = process.env.E2E_CONTENT_ID || "otakudesu:tokyo-revs-sanhen-sub-indo";
const EPISODE_ID = process.env.E2E_EPISODE_ID || "tkrvgs-s4-episode-2-sub-indo";
const stamp = Date.now().toString().slice(-6);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function newContext(browser) {
  if (typeof browser.createBrowserContext === "function") {
    return browser.createBrowserContext();
  }
  return browser.createIncognitoBrowserContext();
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(SHOT, name), fullPage });
  console.log("SHOT", name);
}

async function register(page, username, email) {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle2", timeout: 90000 });
  await page.type("#username", username);
  await page.type("#email", email);
  await page.type("#password", "rahasia12345");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);
}

async function main() {
  fs.mkdirSync(SHOT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=1440,900",
    ],
  });

  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on("pageerror", (error) => console.log("PAGEERR:", String(error).slice(0, 200)));

  console.log("== 1. home ==");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(2000);
  await shot(page, "01-home.png");
  await shot(page, "01b-home-full.png", true);

  console.log("== 2. register ==");
  await register(page, `raja_nobar_${stamp}`, `raja_${stamp}@nobar.test`);
  console.log("url after register:", page.url());
  await shot(page, "02-after-register.png");

  console.log("== 3. explore ==");
  await page.goto(`${BASE}/explore`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(1500);
  await shot(page, "03-explore.png");
  await shot(page, "03b-explore-full.png", true);

  console.log("== 4. detail ==");
  await page.goto(`${BASE}/anime/${CONTENT_ID}`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(1500);
  await shot(page, "04-detail.png");
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Favorit"));
    if (button) button.click();
  });
  await sleep(1800);
  await shot(page, "04b-detail-favorited.png");

  console.log("== 5. watch (waiting for resolver) ==");
  await page.goto(`${BASE}/watch/${CONTENT_ID}/${EPISODE_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(22000);
  await shot(page, "05-watch.png");

  console.log("== 6. create room ==");
  await page.goto(`${BASE}/nobar/create?contentId=${CONTENT_ID}&episodeId=${EPISODE_ID}`, {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await sleep(2000);
  await shot(page, "06-create-room.png");
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) =>
      item.textContent.includes("Buat Room & Mulai Nobar")
    );
    if (button) button.click();
  });
  await sleep(4000);
  const roomUrl = page.url();
  console.log("room url:", roomUrl);
  await sleep(20000); // stream resolve inside room
  await shot(page, "07-room-host.png");

  console.log("== 7. guest joins ==");
  const ctx2 = await newContext(browser);
  const guest = await ctx2.newPage();
  await guest.setViewport({ width: 1440, height: 900 });
  await register(guest, `teman_nobar_${stamp}`, `teman_${stamp}@nobar.test`);
  await guest.goto(roomUrl, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(18000);
  await shot(guest, "08-room-guest.png");

  console.log("== 8. chat both ways ==");
  await guest.type("textarea", "Halo, ikut nobar ya!");
  await guest.keyboard.press("Enter");
  await sleep(1800);
  await shot(guest, "09-guest-chat.png");
  await shot(page, "10-host-sees-chat.png");

  console.log("== 9. host plays, guest syncs ==");
  await page.mouse.move(720, 380);
  await sleep(400);
  const played = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Putar"]');
    if (button) {
      button.click();
      return true;
    }
    return false;
  });
  console.log("host play clicked:", played);
  await sleep(5000);
  await shot(page, "11-host-playing.png");
  await shot(guest, "11b-guest-synced.png");

  const guestState = await guest.evaluate(() => {
    const video = document.querySelector("video");
    return video ? { paused: video.paused, t: Math.round(video.currentTime) } : null;
  });
  const hostState = await page.evaluate(() => {
    const video = document.querySelector("video");
    return video ? { paused: video.paused, t: Math.round(video.currentTime) } : null;
  });
  console.log("host video:", JSON.stringify(hostState), "guest video:", JSON.stringify(guestState));

  console.log("== 10. profile ==");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(2000);
  await shot(page, "12-profile.png");
  await shot(page, "12b-profile-full.png", true);

  console.log("== 11. nobar list ==");
  await page.goto(`${BASE}/nobar`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(1500);
  await shot(page, "13-nobar-list.png");

  console.log("== 12. rooms mine ==");
  await page.goto(`${BASE}/rooms`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(1500);
  await shot(page, "14-my-rooms.png");

  console.log("== 13. login page ==");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(1000);
  await shot(page, "15-login.png");

  console.log("== 14. mobile ==");
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(2000);
  await shot(mobile, "16-mobile-home.png");
  await mobile.goto(`${BASE}/anime/naruto`, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(1500);
  await shot(mobile, "17-mobile-detail.png");
  await mobile.goto(roomUrl, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(3000);
  await shot(mobile, "18-mobile-room.png");

  await browser.close();
  console.log("E2E DONE");
}

main().catch((error) => {
  console.error("E2E CRASH:", error);
  process.exit(1);
});
