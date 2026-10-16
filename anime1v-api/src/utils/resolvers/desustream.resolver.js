const { getBrowser } = require("../browser");

/**
 * DesuStream resolver (used by otakudesu mirrors: odcdn / arcg / odstream / ondesu).
 *
 * The player pages (https://desustream.net/dstream/...) are Cloudflare
 * protected and "lazy load" the media: the stream URL is either present in the
 * page markup (`<source src="...">`, `video.src = "..."`) or set right after
 * the user presses play. Depending on the variant the media lives on
 * cdn.odcloud.net (plain MP4) or on Google's videoplayback CDN (blogger source).
 *
 * Strategy: open the page in the shared Chromium (passes Cloudflare), extract
 * the media URL from the markup; if it is not there yet, click the player and
 * wait for the source to appear (network sniff + video.currentSrc fallback).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const CHALLENGE_RE = /just a moment|attention required|checking your browser|cf-browser-verification/i;

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

function pickFromHtml(html) {
  const sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (sourceMatch && /\.(mp4|m3u8)|videoplayback/i.test(sourceMatch[1])) {
    return decodeEntities(sourceMatch[1]);
  }
  const mp4Match = html.match(/https?:\/\/[^"'\\\s<>]+\.mp4(?:\?[^"'\\\s<>]*)?/i);
  if (mp4Match) {
    return decodeEntities(mp4Match[0]);
  }
  const m3u8Match = html.match(/https?:\/\/[^"'\\\s<>]+\.m3u8(?:\?[^"'\\\s<>]*)?/i);
  if (m3u8Match) {
    return decodeEntities(m3u8Match[0]);
  }
  return null;
}

async function extractDesustream(pageUrl) {
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent(UA);

    let sniffed = null;
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const target = request.url();
      const type = request.resourceType();
      if (
        !sniffed &&
        type !== "document" &&
        /(\.mp4|\.m3u8|videoplayback)(\?|#|$)/i.test(target) &&
        !target.startsWith("blob:")
      ) {
        sniffed = target;
      }
      if (type === "image" || type === "font" || type === "stylesheet") {
        request.abort();
        return;
      }
      request.continue();
    });

    try {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    } catch (_navError) {
      /* navigation timeouts must not abort extraction */
    }

    // Wait for the Cloudflare challenge to clear.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const title = await page.title().catch(() => "");
      if (!CHALLENGE_RE.test(title)) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));

    let html = await page.content();
    let url = pickFromHtml(html);

    if (!url) {
      // Trigger the lazy player: click the overlay / video area.
      await page.mouse.click(640, 360).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 3500));
      html = await page.content();
      url = pickFromHtml(html);
    }

    if (!url && sniffed) {
      url = sniffed;
    }

    if (!url) {
      url = await page
        .evaluate(() => {
          const video = document.querySelector("video");
          return video ? video.currentSrc || video.src || "" : "";
        })
        .catch(() => "");
    }

    if (!url || !/^https?:\/\//i.test(url)) {
      return null;
    }
    return decodeEntities(url);
  } catch (_error) {
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
  }
}

module.exports = { extractDesustream };
