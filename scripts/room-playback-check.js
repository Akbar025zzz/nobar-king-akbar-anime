/* Room playback + sync verification with two real browser sessions.
 * Creates a fresh room via the API first, so results are not polluted by
 * any previous room state. */
const path = require("path");
// puppeteer is installed with the vendored anime1v-api (npm install there).
const puppeteer = require(require.resolve("puppeteer", {
  paths: [path.join(__dirname, "..", "anime1v-api")],
}));

const BASE = process.env.E2E_BASE || "https://3000-irhefyuqda4fhazi9n5r4-24916fab.sg2.manus.computer";
const SHOT = "/home/ubuntu/nobar-king-akbar-anime/docs/screenshots";
const CONTENT_ID = process.env.ROOM_CONTENT_ID || "otakudesu:tokyo-revs-sanhen-sub-indo";
const EPISODE_ID = process.env.ROOM_EPISODE_ID || "tkrvgs-s4-episode-2-sub-indo";
const HOST_EMAIL = process.env.HOST_EMAIL || "raja_843784@nobar.test";
const GUEST_EMAIL = process.env.GUEST_EMAIL || "teman_843784@nobar.test";
const PASSWORD = "rahasia12345";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiLogin(email) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/nka_session=([^;]+)/);
  if (!match) throw new Error(`login failed for ${email}: ${response.status}`);
  return match[1];
}

async function createRoom(cookie) {
  const response = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `nka_session=${cookie}` },
    body: JSON.stringify({
      contentId: CONTENT_ID,
      episodeId: EPISODE_ID,
      roomName: "Uji Sinkronisasi Pemutaran",
      privacy: "public",
    }),
  });
  const body = await response.json();
  if (!body?.data?.id) throw new Error(`room creation failed: ${JSON.stringify(body).slice(0, 200)}`);
  return body.data.id;
}

async function context(browser) {
  return typeof browser.createBrowserContext === "function"
    ? browser.createBrowserContext()
    : await browser.createIncognitoBrowserContext();
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 90000 });
  await page.type("#email", email);
  await page.type("#password", PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);
}

async function videoState(page) {
  return page.evaluate(() => {
    const video = document.querySelector("video");
    if (!video) return null;
    return {
      paused: video.paused,
      t: Number(video.currentTime.toFixed(2)),
      readyState: video.readyState,
      w: video.videoWidth,
    };
  });
}

(async () => {
  const hostCookie = await apiLogin(HOST_EMAIL);
  const roomId = await createRoom(hostCookie);
  console.log("fresh room:", roomId);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  });

  const hostCtx = await context(browser);
  const host = await hostCtx.newPage();
  await host.setViewport({ width: 1440, height: 900 });
  await login(host, HOST_EMAIL);
  await host.goto(`${BASE}/nobar/room/${roomId}`, { waitUntil: "networkidle2", timeout: 90000 });
  await host.waitForFunction(
    () => {
      const video = document.querySelector("video");
      return Boolean(video) && video.duration > 0 && video.readyState >= 2;
    },
    { timeout: 90000 }
  );
  console.log("host stream ready");

  const guestCtx = await context(browser);
  const guest = await guestCtx.newPage();
  await guest.setViewport({ width: 1440, height: 900 });
  await login(guest, GUEST_EMAIL);
  await guest.goto(`${BASE}/nobar/room/${roomId}`, { waitUntil: "networkidle2", timeout: 90000 });
  await guest.waitForFunction(
    () => {
      const video = document.querySelector("video");
      return Boolean(video) && video.duration > 0 && video.readyState >= 2;
    },
    { timeout: 90000 }
  );
  console.log("guest stream ready");

  await host.mouse.move(720, 380);
  await sleep(300);
  await host.evaluate(() => {
    const button = document.querySelector('button[aria-label="Putar"]');
    if (button) button.click();
  });
  console.log("host clicked play");
  await sleep(10000);

  const hostA = await videoState(host);
  const guestA = await videoState(guest);
  console.log("host:", JSON.stringify(hostA));
  console.log("guest:", JSON.stringify(guestA));

  await host.screenshot({ path: `${SHOT}/19-room-play-host.png` });
  await guest.screenshot({ path: `${SHOT}/20-room-play-guest.png` });

  // pause propagation
  await host.evaluate(() => {
    const button = document.querySelector('button[aria-label="Jeda"]');
    if (button) button.click();
  });
  await sleep(3500);
  const hostB = await videoState(host);
  const guestB = await videoState(guest);
  console.log("after pause -> host:", JSON.stringify(hostB), "guest:", JSON.stringify(guestB));

  const hostPlaying = hostA && !hostA.paused && hostA.t > 2 && hostA.w > 0;
  const guestPlaying = guestA && !guestA.paused && guestA.t > 0 && guestA.w > 0;
  const drift = hostA && guestA ? Math.abs(hostA.t - guestA.t) : null;
  const synced = drift !== null && drift < 3;
  const pauseSynced = Boolean(hostB && guestB && hostB.paused && guestB.paused);

  console.log("host playing:", hostPlaying, "| guest playing:", guestPlaying, "| drift:", drift, "| pause synced:", pauseSynced);
  console.log(
    hostPlaying && guestPlaying && synced && pauseSynced ? "ROOM PLAYBACK + SYNC VERIFIED" : "ROOM PLAYBACK PROBLEM"
  );

  await browser.close();
  process.exit(hostPlaying && guestPlaying && synced && pauseSynced ? 0 : 1);
})().catch((error) => {
  console.error("CRASH:", error);
  process.exit(1);
});
