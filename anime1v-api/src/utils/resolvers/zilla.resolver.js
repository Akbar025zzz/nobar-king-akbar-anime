const { axiosGet } = require("../resolver-helpers");

/**
 * Zilla Networks HLS resolver.
 *
 * The player page (https://player.zilla-networks.com/play/<id>) only renders
 * when embedded inside an iframe and loads its stream from its own public
 * endpoint: https://player.zilla-networks.com/m3u8/<id>
 * This resolver extracts the id and verifies that the m3u8 endpoint really
 * returns an HLS manifest before reporting success.
 */
async function extractZilla(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (!/player\.zilla-networks\.com$/i.test(u.hostname)) {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    if (!id || !/^[A-Za-z0-9]{16,64}$/.test(id)) {
      return null;
    }

    const streamUrl = `https://player.zilla-networks.com/m3u8/${id}`;
    const res = await axiosGet(streamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://player.zilla-networks.com/",
      },
      timeout: 8000,
    });

    const body = typeof res.data === "string" ? res.data : "";
    if (body.includes("#EXTM3U")) {
      return streamUrl;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

module.exports = { extractZilla };
