/* Verify real video playback: currentTime advances + frames decoded */
const path = require("path");
// puppeteer is installed with the vendored anime1v-api (npm install there).
const puppeteer = require(require.resolve("puppeteer", {
  paths: [path.join(__dirname, "..", "anime1v-api")],
}));

const BASE = process.env.E2E_BASE || "https://3000-irhefyuqda4fhazi9n5r4-24916fab.sg2.manus.computer";
const URL = process.env.E2E_WATCH || `${BASE}/watch/otakudesu:tokyo-revs-sanhen-sub-indo/tkrvgs-s4-episode-2-sub-indo`;
const SHOT = "/home/ubuntu/nobar-king-akbar-anime/docs/screenshots/05b-watch-playing.png";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  console.log("goto", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });

  try {
    await page.waitForFunction(
      () => {
        const video = document.querySelector("video");
        return Boolean(video) && video.duration > 0 && video.readyState >= 2;
      },
      { timeout: 120000 }
    );
    console.log("video metadata ready");
  } catch (error) {
    const state = await page.evaluate(() => {
      const video = document.querySelector("video");
      return {
        hasVideo: Boolean(video),
        readyState: video ? video.readyState : null,
        duration: video ? video.duration : null,
        errorText: document.body.innerText.slice(0, 400),
      };
    });
    console.log("DIAGNOSTICS:", JSON.stringify(state));
    await page.screenshot({ path: "/tmp/playback-fail.png" });
    await browser.close();
    process.exit(1);
  }

  await page.evaluate(() => {
    const video = document.querySelector("video");
    if (video) void video.play().catch(() => undefined);
  });

  await sleep(4000);
  const first = await page.evaluate(() => document.querySelector("video").currentTime);
  await sleep(7000);
  const second = await page.evaluate(() => document.querySelector("video").currentTime);
  const info = await page.evaluate(() => {
    const video = document.querySelector("video");
    return {
      currentTime: video.currentTime,
      duration: video.duration,
      paused: video.paused,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    };
  });

  console.log("t(4s):", first.toFixed(2), "t(11s):", second.toFixed(2));
  console.log("video info:", JSON.stringify(info));
  console.log(
    second - first > 3 && info.videoWidth > 0
      ? "PLAYBACK VERIFIED: currentTime advances and frames are decoded"
      : "PLAYBACK PROBLEM: playback did not advance as expected"
  );

  await page.screenshot({ path: SHOT });
  console.log("SHOT", SHOT);

  await browser.close();
  process.exit(second - first > 3 && info.videoWidth > 0 ? 0 : 1);
})().catch((error) => {
  console.error("CHECK CRASH:", error);
  process.exit(1);
});
