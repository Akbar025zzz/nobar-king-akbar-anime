/* Browser-backed fetch.
 *
 * Several sub-Indo sources (otakudesu.*, kuramanime.*) sit behind Cloudflare
 * bot management: plain `fetch` receives a 403 challenge page, while a real
 * Chromium browser passes it (JS challenge + fingerprint checks).
 *
 * This helper keeps ONE warm Chromium instance and one page per origin. All
 * requests are executed with `fetch()` INSIDE that page, so they inherit the
 * browser's cookies (cf_clearance), TLS fingerprint and same-origin policy —
 * which makes both GET pages and the WordPress admin-ajax POSTs work.
 */
import puppeteer, { type Browser, type Page } from "puppeteer";

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
  "--window-size=1440,900",
];

const CHALLENGE_RE = /just a moment|attention required|checking your browser|cf-browser-verification/i;

let browserPromise: Promise<Browser> | null = null;
const pagePromises = new Map<string, Promise<Page>>();

/* Idle shutdown: Chromium is the heaviest part of this service, so it is closed
 * after BROWSER_IDLE_MS without requests and relaunched on demand. That keeps a
 * small VPS (2 GB, often shared with other services) comfortable at low traffic. */
const IDLE_MS = Number(process.env.BROWSER_IDLE_MS ?? 600_000);
let lastUsedAt = Date.now();
let idleTimer: NodeJS.Timeout | null = null;

function markUsed(): void {
  lastUsedAt = Date.now();
  if (idleTimer || IDLE_MS <= 0) return;
  idleTimer = setInterval(() => {
    if (Date.now() - lastUsedAt < IDLE_MS) return;
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
    void closeBrowser().then(() => {
      console.log(`browserFetch: Chromium ditutup setelah ${Math.round(IDLE_MS / 1000)}s idle`);
    });
  }, Math.min(30_000, Math.max(5_000, IDLE_MS / 4)));
  idleTimer.unref?.();
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true, args: LAUNCH_ARGS }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

async function waitUntilClear(page: Page, origin: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const title = await page.title().catch(() => "");
    if (!CHALLENGE_RE.test(title)) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  // One last navigation attempt before giving up.
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
}

async function getPage(origin: string): Promise<Page> {
  let promise = pagePromises.get(origin);
  if (!promise) {
    promise = (async () => {
      const browser = await getBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(userAgent);
      await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await waitUntilClear(page, origin);
      return page;
    })().catch((error) => {
      pagePromises.delete(origin);
      throw error;
    });
    pagePromises.set(origin, promise);
  }
  return promise;
}

interface FetchInit {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export interface BrowserFetchResult {
  status: number;
  text: string;
  contentType: string;
}

async function runFetch(page: Page, url: string, init: FetchInit): Promise<BrowserFetchResult> {
  return page.evaluate(
    async (target, options) => {
      const requestInit: RequestInit = {
        method: options.method ?? "GET",
        credentials: "include",
      };
      if (options.body !== undefined) requestInit.body = options.body;
      if (options.headers !== undefined) requestInit.headers = options.headers;

      const response = await fetch(target, requestInit);
      return {
        status: response.status,
        text: await response.text(),
        contentType: response.headers.get("content-type") ?? "",
      };
    },
    url,
    { method: init.method, body: init.body, headers: init.headers }
  );
}

export async function browserFetch(url: string, init: FetchInit = {}): Promise<BrowserFetchResult> {
  const origin = new URL(url).origin;
  markUsed();
  const page = await getPage(origin);
  let result = await runFetch(page, url, init);
  markUsed();

  if (result.status >= 400 && CHALLENGE_RE.test(result.text)) {
    // Clearance expired: drop the page, re-clear and retry once.
    pagePromises.delete(origin);
    const freshPage = await getPage(origin);
    result = await runFetch(freshPage, url, init);
    markUsed();
  }

  return result;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  pagePromises.clear();
  await browser?.close().catch(() => undefined);
}
