/* Jelajah panel Pterodactyl: login (melewati Cloudflare), daftar server,
 * egg/startup, database, dan buat API key untuk otomasi berikutnya.
 *
 *   node scripts/panel-explore.js
 *
 * Kredensial dibaca dari /home/ubuntu/panel-access.env (tidak masuk repo).
 */
const fs = require("node:fs");
const path = require("node:path");

const puppeteer = require(
  require.resolve("puppeteer", {
    paths: [path.join(__dirname, "..", "anime1v-api", "node_modules")],
  })
);

const envText = fs.readFileSync("/home/ubuntu/panel-access.env", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

const SHOTS = "/home/ubuntu/panel-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const report = { steps: [], servers: [], apiKey: null, inputs: null };

function note(text) {
  console.log(text);
  report.steps.push(text);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }).catch(() => undefined);
}

const CHALLENGE = /just a moment|attention required|checking your browser|cf-browser-verification/i;

async function waitClear(page, maxAttempts = 25) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const title = await page.title().catch(() => "");
    if (!CHALLENGE.test(title)) return true;
    if (attempt > 1 && attempt % 2 === 0) await solveTurnstile(page);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return false;
}

/* Turnstile interaktif: klik kotak centang di dalam iframe tantangan. */
async function solveTurnstile(page) {
  try {
    // Koordinat iframe harus diambil dari halaman utama (posisi di viewport).
    const box = await page.evaluate(() => {
      const iframe = Array.from(document.querySelectorAll("iframe")).find((el) =>
        /challenges\.cloudflare\.com/.test(el.src || "")
      );
      if (!iframe) return null;
      const rect = iframe.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (!box || box.width < 10) {
      console.log("   [turnstile] widget belum terlihat");
      return false;
    }
    const target = { x: box.x + 30, y: box.y + box.height / 2 };
    console.log(
      "   [turnstile] iframe",
      Math.round(box.x),
      Math.round(box.y),
      Math.round(box.width) + "x" + Math.round(box.height),
      "→ klik",
      Math.round(target.x),
      Math.round(target.y)
    );
    await page.mouse.click(target.x, target.y).catch(() => undefined);
    return true;
  } catch {
    /* lanjutkan */
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: process.env.HEADFUL === "1" ? false : true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 960 });

  note("1. Buka halaman login (menunggu Cloudflare)");
  await page.goto(`${env.PANEL_URL}/auth/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const cleared = await waitClear(page);
  note("   tantangan Cloudflare: " + (cleared ? "selesai" : "MASIH AKTIF"));
  await shot(page, "01-login");
  note("   judul: " + (await page.title()));

  note("2. Cari field login");
  await page.waitForSelector("input", { timeout: 90000 }).catch(() => undefined);
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((el) => ({
      id: el.id,
      name: el.name,
      type: el.type,
    }))
  );
  report.inputs = inputs;
  note("   input: " + JSON.stringify(inputs));

  const emailSel = inputs.some((i) => i.id === "email")
    ? "#email"
    : inputs.some((i) => i.name === "email")
      ? "input[name=email]"
      : "input[type=email]";
  const passSel = inputs.some((i) => i.id === "password")
    ? "#password"
    : inputs.some((i) => i.name === "password")
      ? "input[name=password]"
      : "input[type=password]";

  note("3. Login sebagai " + env.PANEL_USER);
  await page.click(emailSel, { clickCount: 3 }).catch(() => undefined);
  await page.type(emailSel, env.PANEL_USER, { delay: 25 });
  await page.type(passSel, env.PANEL_PASS, { delay: 25 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => undefined),
    page.click("button[type=submit]"),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 4000));
  note("   URL setelah login: " + page.url());
  await shot(page, "02-beranda");

  const loggedIn = !/\/auth\/login/.test(page.url());
  note("   status: " + (loggedIn ? "BERHASIL LOGIN" : "GAGAL LOGIN"));
  if (!loggedIn) {
    const text = await page.evaluate(() => document.body.innerText).catch(() => "");
    note("   halaman: " + text.replace(/\s+/g, " ").slice(0, 300));
    fs.writeFileSync("/home/ubuntu/panel-report.json", JSON.stringify(report, null, 2));
    await browser.close();
    return;
  }

  note("4. Kumpulkan daftar server");
  await page.goto(`${env.PANEL_URL}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitClear(page);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const servers = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href*='/server/']"));
    const map = new Map();
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      const uuid = href.split("/server/")[1]?.split(/[/?#]/)[0];
      if (!uuid || uuid.length < 20) continue;
      if (!map.has(uuid)) map.set(uuid, { uuid, href, text: (anchor.innerText || "").trim().slice(0, 200) });
    }
    return Array.from(map.values());
  });
  report.servers = servers;
  note("   jumlah server: " + servers.length);
  for (const server of servers) {
    note("   - " + server.uuid + " :: " + server.text.replace(/\s+/g, " | ").slice(0, 140));
  }
  const listText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(SHOTS, "server-list.txt"), listText);
  await shot(page, "03-daftar-server");

  if (servers.length) {
    const first = servers[0];
    note("5. Detail server: " + first.uuid);
    await page.goto(`${env.PANEL_URL}${first.href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitClear(page);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await shot(page, "04-server");
    fs.writeFileSync(
      path.join(SHOTS, "server-detail.txt"),
      await page.evaluate(() => document.body.innerText)
    );

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a")).map((a) => ({
        text: (a.innerText || "").trim(),
        href: a.getAttribute("href"),
      }))
    );
    fs.writeFileSync(path.join(SHOTS, "server-tabs.json"), JSON.stringify(tabs, null, 2));

    for (const [label, pattern] of [
      ["startup", /startup/i],
      ["databases", /database/i],
      ["files", /file/i],
      ["console", /console/i],
    ]) {
      const tab = tabs.find((t) => t.href && t.href.startsWith("/server/") && pattern.test(t.text));
      if (!tab) {
        note("   tab " + label + ": tidak ada");
        continue;
      }
      await page.goto(`${env.PANEL_URL}${tab.href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitClear(page);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await shot(page, `05-${label}`);
      const text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(path.join(SHOTS, `server-${label}.txt`), text);
      note("   tab " + label + " tersimpan");
    }
  }

  note("6. Buat API key untuk otomasi");
  await page.goto(`${env.PANEL_URL}/account/api`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitClear(page);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await shot(page, "06-api");
  const apiText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(SHOTS, "api-page.txt"), apiText);

  const description = "manus-deploy-" + Date.now().toString(36);
  const created = await page.evaluate(async (desc) => {
    const csrf = document.querySelector("meta[name=csrf-token]")?.getAttribute("content") || "";
    const res = await fetch("/account/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrf,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      body: JSON.stringify({ description: desc, allowed_ips: [] }),
    });
    return { status: res.status, text: (await res.text()).slice(0, 600) };
  }, description);

  note("   status API key: " + created.status);
  const match = /ptlc_[A-Za-z0-9]+/.exec(created.text);
  if (match) {
    report.apiKey = match[0];
    note("   API key: " + match[0].slice(0, 14) + "…");
  } else {
    note("   respons: " + created.text.replace(/\s+/g, " ").slice(0, 300));
  }

  fs.writeFileSync("/home/ubuntu/panel-report.json", JSON.stringify(report, null, 2));
  console.log("\n=== RINGKASAN ===");
  console.log(
    JSON.stringify(
      {
        login: "OK",
        servers: report.servers.map((s) => ({ uuid: s.uuid, text: s.text.replace(/\s+/g, " ") })),
        apiKey: report.apiKey ? "ADA" : "TIDAK ADA",
      },
      null,
      2
    )
  );

  await browser.close();
})().catch((error) => {
  console.error("GAGAL:", error.message);
  process.exit(1);
});
