#!/usr/bin/env node
/**
 * Realtime room verification — two clients (host + guest) over Socket.IO.
 *
 * Usage:
 *   node scripts/realtime-check.js <ROOM_ID> <HOST_SESSION_COOKIE> [BASE_URL]
 *
 * - ROOM_ID: id of an active room (create one via the UI or POST /api/rooms)
 * - HOST_SESSION_COOKIE: value of the `nka_session` cookie for the room host
 *   (copy it from your browser devtools after logging in)
 * - BASE_URL: defaults to http://localhost:4000
 *
 * Requires `socket.io-client` (available in frontend/node_modules).
 */
const path = require("path");

const BASE = process.argv[4] || "http://localhost:4000";
const ROOM_ID = process.argv[2];
const HOST_TOKEN = process.argv[3];

if (!ROOM_ID || !HOST_TOKEN) {
  console.error("Usage: node scripts/realtime-check.js <ROOM_ID> <HOST_SESSION_COOKIE> [BASE_URL]");
  process.exit(2);
}

const { io } = require(require.resolve("socket.io-client", {
  paths: [path.join(__dirname, "..", "frontend"), path.join(__dirname, "..")],
}));

const results = [];
const check = (name, ok) => {
  results.push({ name, ok });
  console.log(ok ? "PASS" : "FAIL", "-", name);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connect(token) {
  return io(BASE, {
    path: "/socket.io",
    transports: ["websocket"],
    extraHeaders: { Cookie: `nka_session=${token}` },
    forceNew: true,
  });
}

async function guestToken() {
  const email = `tamu_${Date.now()}@nobar.test`;
  const response = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `tamu_${Date.now()}`, email, password: "rahasia12345" }),
  });
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/nka_session=([^;]+)/);
  if (!match) throw new Error("gagal membuat akun tamu");
  return match[1];
}

async function main() {
  const guest = await guestToken();
  const host = connect(HOST_TOKEN);
  const guestSocket = connect(guest);
  const events = { host: [], guest: [] };

  const bind = (socket, bucket) => {
    for (const event of ["room:joined", "room:update", "player:sync", "chat:message", "room:error", "room:end", "chat:history"]) {
      socket.on(event, (payload) => bucket.push({ type: event, payload }));
    }
  };
  bind(host, events.host);
  bind(guestSocket, events.guest);

  await wait(1200);
  check("dua klien terhubung", host.connected && guestSocket.connected);

  host.emit("room:join", { roomId: ROOM_ID });
  await wait(1200);
  check("host bergabung ke room", events.host.some((item) => item.type === "room:joined"));

  host.emit("player:play", { position: 42 });
  await wait(800);

  guestSocket.emit("room:join", { roomId: ROOM_ID });
  await wait(1500);
  check("peserta bergabung ke room", events.guest.some((item) => item.type === "room:joined"));

  const sync = [...events.guest].reverse().find((item) => item.type === "player:sync");
  check(
    "peserta menerima sinkronisasi putar (~42 dtk)",
    Boolean(sync) && sync.payload.isPlaying === true && sync.payload.position >= 42
  );

  const presence = [...events.host].reverse().find((item) => item.type === "room:update");
  check("host melihat 2 peserta", Boolean(presence) && presence.payload.participantCount === 2);

  guestSocket.emit("chat:message", { message: "Halo dari peserta!" });
  await wait(900);
  check("host menerima chat", events.host.some((item) => item.type === "chat:message" && item.payload.message === "Halo dari peserta!"));
  check("peserta menerima echo chat", events.guest.some((item) => item.type === "chat:message"));

  guestSocket.emit("player:pause", { position: 10 });
  await wait(700);
  check(
    "peserta tidak boleh mengendalikan pemutaran (NOT_ROOM_HOST)",
    events.guest.some((item) => item.type === "room:error" && item.payload.code === "NOT_ROOM_HOST")
  );

  host.emit("player:pause", { position: 55 });
  await wait(700);
  const paused = [...events.guest].reverse().find((item) => item.type === "player:sync");
  check("peserta menerima jeda (~55 dtk)", Boolean(paused) && paused.payload.isPlaying === false && Math.abs(paused.payload.position - 55) < 1);

  host.emit("player:seek", { position: 120 });
  await wait(700);
  const seeked = [...events.guest].reverse().find((item) => item.type === "player:sync");
  check("peserta menerima lompatan (~120 dtk)", Boolean(seeked) && Math.abs(seeked.payload.position - 120) < 1);

  host.emit("room:end", {});
  await wait(1000);
  check("peserta diberi tahu room berakhir", events.guest.some((item) => item.type === "room:end"));

  host.close();
  guestSocket.close();

  const failed = results.filter((item) => !item.ok);
  console.log(`\nRESULT: ${results.length - failed.length}/${results.length} lulus`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("CRASH:", error);
  process.exit(1);
});
