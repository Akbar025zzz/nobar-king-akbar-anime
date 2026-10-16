import otakudesuConfig from "@configs/otakudesu.config.js";
import getHTML from "@helpers/getHTML.js";
import { browserFetch } from "@helpers/browserFetch.js";
import { parse, type HTMLElement } from "node-html-parser";

const { baseUrl } = otakudesuConfig;

const otakudesuScraper = {
  async scrapeDOM(pathname: string, ref?: string, sanitize: boolean = false): Promise<HTMLElement> {
    // otakudesu is Cloudflare-protected: fetch through the warm browser.
    const html = await getHTML(baseUrl, pathname, ref, sanitize, true);
    const document = parse(html, {
      parseNoneClosedTags: true,
    });

    return document;
  },

  async scrapeNonce(body: string, referer: string): Promise<{ data?: string }> {
    const nonceResponse = await browserFetch(new URL("/wp-admin/admin-ajax.php", baseUrl).toString(), {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: referer,
        Origin: baseUrl,
      },
    });

    const nonce = JSON.parse(nonceResponse.text) as { data: string };

    return nonce;
  },

  async scrapeServer(body: string, referer: string): Promise<{ data?: string }> {
    const serverResponse = await browserFetch(new URL("/wp-admin/admin-ajax.php", baseUrl).toString(), {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: baseUrl,
        Referer: referer,
      },
    });

    const server = JSON.parse(serverResponse.text) as { data: string };

    return server;
  },
};

export default otakudesuScraper;
