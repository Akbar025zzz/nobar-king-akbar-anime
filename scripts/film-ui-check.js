/* Verifikasi UI fitur Film & Series (katalog, detail, watch) via gateway publik. */
const fs = require("fs");
const path = require("path");
const puppeteer = require(require.resolve("puppeteer", {
  paths: [path.join(__dirname, "..", "anime1v-api")],
}));

const BASE = process.env.E2E_BASE || "https://3000-irhefyuqda4fhazi9n5r4-24916fab.sg2.manus.computer";
const SHOT = "/home/ubuntu/nobar-king-akbar-anime/docs/screenshots";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(SHOT, name), fullPage });
  console.log("SHOT", name);
}

async function main() {
  fs.mkdirSync(SHOT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,980"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 980 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 200)}`);
  });

  // 1. Katalog film
  console.log("== 1. /film ==");
  await page.goto(`${BASE}/film`, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(1500);
  const catalog = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('a[href^="/film/tmdb%3A"], a[href^="/film/tmdb:"]'));
    const rails = Array.from(document.querySelectorAll("section")).length;
    return {
      cards: cards.length,
      sampleTitles: cards.slice(0, 6).map((a) => a.textContent.trim().slice(0, 60)),
      sections: rails,
      hasPosterImages: Array.from(document.querySelectorAll('img[src*="image.tmdb.org"]')).length,
    };
  });
  console.log("katalog:", JSON.stringify(catalog));
  await shot(page, "21-film-catalog.png");
  await shot(page, "22-film-catalog-full.png", true);

  // 2. Detail film
  console.log("== 2. /film/tmdb:movie:94329 ==");
  await page.goto(`${BASE}/film/${encodeURIComponent("tmdb:movie:94329")}`, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(1500);
  const detail = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasTitle: /The Raid/i.test(text),
      runtime: /101|1 jam 41/i.test(text),
      castMentions: /Iko Uwais|Joe Taslim|Yayan Ruhian/i.test(text),
      trailerButton: Boolean(Array.from(document.querySelectorAll("button")).find((b) => /trailer/i.test(b.textContent || ""))),
      watchLink: Array.from(document.querySelectorAll('a[href*="/watch/"]')).map((a) => a.getAttribute("href")).slice(0, 3),
      nobarLink: Array.from(document.querySelectorAll('a[href*="/nobar/create"]')).length,
    };
  });
  console.log("detail:", JSON.stringify(detail));
  await shot(page, "23-film-detail.png");
  await shot(page, "24-film-detail-full.png", true);

  // 2b. Trailer
  const trailerBtn = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll("button")).find((b) => /trailer/i.test(b.textContent || "")),
  );
  const trailerEl = trailerBtn.asElement();
  if (trailerEl) {
    await trailerEl.click();
    await sleep(2500);
    const trailer = await page.evaluate(() => {
      const frame = document.querySelector('iframe[src*="youtube"]');
      return { present: Boolean(frame), src: frame ? frame.getAttribute("src") : null };
    });
    console.log("trailer:", JSON.stringify(trailer));
    await shot(page, "25-film-trailer.png");
  } else {
    console.log("trailer: TIDAK ADA tombol trailer");
  }

  // 3. Detail series (pilih season)
  console.log("== 3. /film/tmdb:series:1399 ==");
  await page.goto(`${BASE}/film/${encodeURIComponent("tmdb:series:1399")}`, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(1500);
  const series = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasTitle: /Game of Thrones/i.test(text),
      seasonButtons: Array.from(document.querySelectorAll("button"))
        .map((b) => (b.textContent || "").trim())
        .filter((t) => /^Season \d+|^Musim ke \d+/i.test(t)),
      episodeLinks: Array.from(document.querySelectorAll('a[href*="/watch/"]')).length,
      firstEpisodes: Array.from(document.querySelectorAll('a[href*="/watch/"]'))
        .slice(0, 3)
        .map((a) => a.textContent.trim().slice(0, 60)),
    };
  });
  console.log("series:", JSON.stringify(series));
  await shot(page, "26-film-series-detail.png");
  await shot(page, "27-film-series-detail-full.png", true);

  // 4. Watch film
  console.log("== 4. /watch/tmdb:movie:94329/movie ==");
  await page.goto(`${BASE}/watch/${encodeURIComponent("tmdb:movie:94329")}/movie`, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });
  await sleep(4000);
  const watchMovie = await page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll("iframe")).map((f) => f.getAttribute("src"));
    return {
      iframes: frames,
      serverButtons: Array.from(document.querySelectorAll("button"))
        .map((b) => (b.textContent || "").trim())
        .filter((t) => /Server \d/i.test(t)),
      cinemaNote: /mode sinema|kontrol.*provider|di luar kendali/i.test(document.body.innerText),
      newTabLink: Array.from(document.querySelectorAll("a")).filter((a) => /tab baru/i.test(a.textContent || "")).length,
    };
  });
  console.log("watch movie:", JSON.stringify(watchMovie));
  await shot(page, "28-film-watch.png");

  // 5. Watch series
  console.log("== 5. /watch/tmdb:series:1399/s1e1 ==");
  await page.goto(`${BASE}/watch/${encodeURIComponent("tmdb:series:1399")}/s1e1`, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });
  await sleep(4000);
  const watchSeries = await page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll("iframe")).map((f) => f.getAttribute("src"));
    return {
      iframes: frames,
      episodeList: Array.from(document.querySelectorAll('a[href*="/watch/"]')).length,
      hasEpisodeTitle: /Winter Is Coming|Episode 1/i.test(document.body.innerText),
    };
  });
  console.log("watch series:", JSON.stringify(watchSeries));
  await shot(page, "29-film-watch-series.png");

  // 6. Home dengan seksi film
  console.log("== 6. home ==");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(1500);
  const home = await page.evaluate(() => ({
    filmSection: /Film & Series/i.test(document.body.innerText),
    filmCards: document.querySelectorAll('a[href^="/film/tmdb%3A"]').length,
  }));
  console.log("home:", JSON.stringify(home));
  await shot(page, "30-home-film-section.png", true);

  // 7. Mobile
  console.log("== 7. mobile /film ==");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/film`, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(1500);
  await shot(page, "31-film-mobile.png");
  await page.goto(`${BASE}/watch/${encodeURIComponent("tmdb:movie:94329")}/movie`, { waitUntil: "networkidle2", timeout: 120000 });
  await sleep(3500);
  await shot(page, "32-film-watch-mobile.png");

  console.log("ERRORS:", errors.length ? JSON.stringify(errors.slice(0, 10)) : "none");
  await browser.close();
}

main().catch((error) => {
  console.error("FATAL", error);
  process.exit(1);
});
