/*
 * Gateway ringan untuk deployment tanpa root/nginx (mis. container Pterodactyl).
 *
 * Tugasnya sama seperti nginx di docker-compose:
 *   /api/*       → backend Express (:API_PORT)
 *   /socket.io/* → backend Express + WebSocket upgrade
 *   sisanya      → Next.js (:NEXT_PORT)
 *
 * Header Host diteruskan apa adanya sehingga origin guard backend tetap
 * menganggap permintaan sebagai same-origin (tidak perlu daftar CORS manual).
 */
import http from "node:http";
import httpProxy from "http-proxy";

const PORT = Number(process.env.GATEWAY_PORT || 3000);
const API_TARGET = process.env.API_TARGET || "http://127.0.0.1:4000";
const NEXT_TARGET = process.env.NEXT_TARGET || "http://127.0.0.1:3001";

const proxy = httpProxy.createProxyServer({
  ws: true,
  xfwd: true,
  changeOrigin: false,
  timeout: 0,
  proxyTimeout: 0,
});

proxy.on("error", (error, req, res) => {
  const message = `Upstream tidak merespons (${error.code || error.message})`;
  if (res && typeof res.writeHead === "function" && !res.headersSent) {
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "error", error: { code: "GATEWAY_UPSTREAM", message, details: null } }));
    return;
  }
  if (res && typeof res.end === "function") {
    try {
      res.end();
    } catch {
      /* socket sudah tertutup */
    }
  }
});

function isBackendPath(url) {
  return /^\/(api|socket\.io)(\/|$|\?)/.test(url);
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", gateway: PORT, api: API_TARGET, next: NEXT_TARGET }));
    return;
  }

  proxy.web(req, res, { target: isBackendPath(url) ? API_TARGET : NEXT_TARGET });
});

server.on("upgrade", (req, socket, head) => {
  const url = req.url || "/";
  proxy.ws(req, socket, head, { target: isBackendPath(url) ? API_TARGET : NEXT_TARGET });
});

server.on("clientError", (error, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[gateway] mendengarkan di 0.0.0.0:${PORT} → api ${API_TARGET} · web ${NEXT_TARGET}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
