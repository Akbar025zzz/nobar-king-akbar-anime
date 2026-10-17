#!/usr/bin/env node
/*
 * Nobar King Akbar Anime — orkestrator deployment container (tanpa root, tanpa Docker).
 *
 * Menjalankan seluruh stack dalam satu proses induk:
 *   1. PostgreSQL (embedded, tanpa root) — atau database eksternal via DATABASE_URL
 *   2. wajik-anime-api   : sumber katalog anime (otakudesu / oploverz)
 *   3. anime1v-api       : mesin resolver embed → media langsung
 *   4. backend           : Express + Socket.IO
 *   5. frontend          : Next.js (next start)
 *   6. gateway           : proxy /api + /socket.io + halaman web pada satu port publik
 *
 * Cara pakai:
 *   node deploy/panel/start.mjs
 * Konfigurasi: deploy/panel/.env.panel (lihat .env.panel.example)
 */
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PANEL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(PANEL_DIR, "..", "..");
const DATA_DIR = path.join(PANEL_DIR, "data");
const LOG_DIR = path.join(DATA_DIR, "logs");
const PG_DIR = path.join(DATA_DIR, "pgdata");

/* ------------------------------- konfigurasi ------------------------------- */

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(PANEL_DIR, ".env.panel"));
loadEnvFile(path.join(ROOT, ".env"));

const config = {
  gatewayPort: Number(process.env.GATEWAY_PORT || process.env.SERVER_PORT || process.env.PORT || 3000),
  nextPort: Number(process.env.NEXT_PORT || 3001),
  apiPort: Number(process.env.API_PORT || 4000),
  wajikPort: Number(process.env.WAJIK_PORT || 4200),
  resolverPort: Number(process.env.RESOLVER_PORT || 4100),
  pgMode: (process.env.PANEL_DB_MODE || "embedded").toLowerCase(),
  pgPort: Number(process.env.PANEL_PG_PORT || 5433),
  pgUser: process.env.PANEL_PG_USER || "nobar",
  pgPassword: process.env.PANEL_PG_PASSWORD || "nobar_panel_password",
  pgDatabase: process.env.PANEL_PG_DATABASE || "nobar_king",
  contentSource: (process.env.CONTENT_SOURCE || "oploverz").toLowerCase(),
  tmdbKey: process.env.TMDB_API_KEY || "4e44d9029b1270a757cddc766a1bcb63",
  tmdbLanguage: process.env.TMDB_LANGUAGE || "id-ID",
  streamSecret: process.env.STREAM_PROXY_SECRET || "ganti-kunci-hmac-ini-di-produksi",
  resolverKey: process.env.RESOLVER_API_KEY || "nobar-internal-key",
  autoSetup: process.env.AUTO_SETUP !== "0",
  publicUrl: process.env.PUBLIC_URL || "",
};

const children = new Map();
let shuttingDown = false;
let embeddedPg = null;

/* ---------------------------------- utilitas -------------------------------- */

const colors = { info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", ok: "\x1b[32m", dim: "\x1b[2m", reset: "\x1b[0m" };
const stamp = () => new Date().toISOString().slice(11, 19);

function log(kind, message) {
  const color = colors[kind] || colors.info;
  console.log(`${colors.dim}${stamp()}${colors.reset} ${color}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runOnce(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.length > 20000) output = output.slice(-20000);
      if (options.stream) process.stdout.write(chunk);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} gagal (exit ${code})\n${output.slice(-2500)}`));
    });
  });
}

async function waitForPort(port, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.setTimeout(1500, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ok) return true;
    await sleep(600);
  }
  return false;
}

function childEnv(extra) {
  return {
    ...process.env,
    NODE_ENV: "production",
    ...extra,
  };
}

function startChild(name, command, args, options = {}) {
  mkdirSync(LOG_DIR, { recursive: true });
  const logFile = createWriteStream(path.join(LOG_DIR, `${name}.log`), { flags: "a" });
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: childEnv(options.env),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const pipe = (stream, level) => {
    stream.on("data", (chunk) => {
      logFile.write(chunk);
      const text = chunk.toString().replace(/\s+$/, "");
      if (!text) return;
      for (const line of text.split(/\r?\n/).slice(0, 6)) {
        console.log(`${colors.dim}${stamp()}${colors.reset} ${level}[${name}]${colors.reset} ${line.slice(0, 400)}`);
      }
    });
  };
  pipe(child.stdout, colors.info);
  pipe(child.stderr, colors.warn);

  const record = { name, child, command, args, options, restarts: 0, startedAt: Date.now(), logFile };
  children.set(name, record);

  child.on("exit", (code, signal) => {
    children.delete(name);
    logFile.end();
    if (shuttingDown) return;
    log("error", `[${name}] berhenti (code ${code ?? signal})`);
    const uptime = Date.now() - record.startedAt;
    if (uptime < 5000 && record.restarts >= 4) {
      log("error", `[${name}] gagal berulang kali — tidak dijalankan ulang otomatis. Cek deploy/panel/data/logs/${name}.log`);
      return;
    }
    const delay = Math.min(15000, 1500 * (record.restarts + 1));
    record.restarts += 1;
    log("warn", `[${name}] dijalankan ulang dalam ${Math.round(delay / 1000)} dtk…`);
    setTimeout(() => {
      if (!shuttingDown) startChild(name, command, args, options);
    }, delay);
  });

  return record;
}

/* ------------------------------- tahap persiapan ----------------------------- */

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function ensureDependencies() {
  const projects = [
    { name: "panel", dir: PANEL_DIR },
    { name: "wajik-anime-api", dir: path.join(ROOT, "wajik-anime-api") },
    { name: "anime1v-api", dir: path.join(ROOT, "anime1v-api") },
    { name: "backend", dir: path.join(ROOT, "backend") },
    { name: "frontend", dir: path.join(ROOT, "frontend") },
  ];

  for (const project of projects) {
    if (!existsSync(project.dir)) throw new Error(`Folder ${project.name} tidak ditemukan: ${project.dir}`);
    const installed = existsSync(path.join(project.dir, "node_modules"));
    if (installed) continue;
    if (!config.autoSetup) {
      throw new Error(`node_modules untuk ${project.name} belum ada. Jalankan: cd ${project.dir} && npm install`);
    }
    log("warn", `[setup] npm install di ${project.name} (sekali saja, bisa beberapa menit)…`);
    await runOnce("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], {
      cwd: project.dir,
      env: { NODE_OPTIONS: "--max-old-space-size=768" },
      stream: true,
    });
    log("ok", `[setup] ${project.name} siap`);
  }
}

async function ensureBuilds() {
  const nodeOptions = { NODE_OPTIONS: "--max-old-space-size=768" };

  const backendDist = path.join(ROOT, "backend", "dist", "index.js");
  if (!existsSync(backendDist)) {
    log("warn", "[build] kompilasi backend (tsc)…");
    await runOnce("npm", ["run", "build"], { cwd: path.join(ROOT, "backend"), env: nodeOptions, stream: true });
  }

  const wajikDist = path.join(ROOT, "wajik-anime-api", "dist", "index.js");
  if (!existsSync(wajikDist)) {
    log("warn", "[build] kompilasi wajik-anime-api…");
    await runOnce("npm", ["run", "build"], { cwd: path.join(ROOT, "wajik-anime-api"), env: nodeOptions, stream: true });
  }

  const nextDir = path.join(ROOT, "frontend", ".next");
  if (!existsSync(path.join(nextDir, "BUILD_ID"))) {
    log("warn", "[build] build frontend (Next.js) — sekali saja, 1–3 menit…");
    try {
      await runOnce("npm", ["run", "build"], { cwd: path.join(ROOT, "frontend"), env: nodeOptions, stream: true });
    } catch (error) {
      log("warn", "[build] Turbopack gagal, mencoba webpack…");
      await runOnce("npx", ["next", "build"], { cwd: path.join(ROOT, "frontend"), env: nodeOptions, stream: true });
    }
  }
}

async function ensureDatabase() {
  if (config.pgMode === "external") {
    if (!process.env.DATABASE_URL) {
      throw new Error("PANEL_DB_MODE=external tetapi DATABASE_URL belum diisi di deploy/panel/.env.panel");
    }
    log("info", "[db] memakai database eksternal dari DATABASE_URL");
    return process.env.DATABASE_URL;
  }

  ensureDir(DATA_DIR);
  const { default: EmbeddedPostgres } = await import("embedded-postgres");

  const alreadyInitialised = existsSync(path.join(PG_DIR, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: config.pgUser,
    password: config.pgPassword,
    port: config.pgPort,
    persistent: true,
  });

  if (!alreadyInitialised) {
    log("warn", "[db] menyiapkan PostgreSQL embedded (unduh binari sekali)…");
    await pg.initialise();
  }
  await pg.start();
  embeddedPg = pg;

  try {
    await pg.createDatabase(config.pgDatabase);
    log("ok", `[db] database ${config.pgDatabase} dibuat`);
  } catch (error) {
    const message = String(error?.message || error);
    if (!/already exists/i.test(message)) log("warn", `[db] createDatabase: ${message.slice(0, 160)}`);
  }

  log("ok", `[db] PostgreSQL embedded aktif di 127.0.0.1:${config.pgPort}`);
  return `postgres://${config.pgUser}:${encodeURIComponent(config.pgPassword)}@127.0.0.1:${config.pgPort}/${config.pgDatabase}`;
}

/* ---------------------------------- layanan --------------------------------- */

async function startStack(databaseUrl) {
  log("info", "menjalankan layanan…");

  startChild("wajik", "node", ["dist/index.js"], {
    cwd: path.join(ROOT, "wajik-anime-api"),
    env: {
      PORT: String(config.wajikPort),
      HOST: "127.0.0.1",
      BROWSER_IDLE_MS: process.env.BROWSER_IDLE_MS || "120000",
      PUPPETEER_SKIP_DOWNLOAD: "1",
    },
  });
  if (!(await waitForPort(config.wajikPort, 120000))) {
    log("warn", `[wajik] belum membuka port ${config.wajikPort}; lanjut (akan dicoba ulang otomatis)`);
  } else {
    log("ok", `[wajik] siap di :${config.wajikPort}`);
  }

  startChild("resolver", "node", ["src/server.js"], {
    cwd: path.join(ROOT, "anime1v-api"),
    env: {
      PORT: String(config.resolverPort),
      // anime1v-api membaca daftar kunci dari API_KEYS (dipisah koma).
      API_KEYS: config.resolverKey,
      RESOLVER_BROWSER_IDLE_MS: process.env.RESOLVER_BROWSER_IDLE_MS || "120000",
      PUPPETEER_SKIP_DOWNLOAD: "1",
    },
  });
  if (await waitForPort(config.resolverPort, 60000)) {
    log("ok", `[resolver] siap di :${config.resolverPort}`);
  } else {
    log("warn", `[resolver] belum membuka port ${config.resolverPort}; lanjut`);
  }

  startChild("backend", "node", ["dist/index.js"], {
    cwd: path.join(ROOT, "backend"),
    env: {
      PORT: String(config.apiPort),
      DATABASE_URL: databaseUrl,
      FRONTEND_URL: config.publicUrl || `http://127.0.0.1:${config.gatewayPort}`,
      CORS_ORIGINS: config.publicUrl || "",
      SESSION_COOKIE_NAME: "nka_session",
      SESSION_TTL_DAYS: "30",
      WAJIK_API_URL: `http://127.0.0.1:${config.wajikPort}`,
      WAJIK_TIMEOUT_MS: "60000",
      WAJIK_CACHE_TTL: "300",
      CONTENT_SOURCE: config.contentSource,
      RESOLVER_API_URL: `http://127.0.0.1:${config.resolverPort}/api/v1/anime`,
      RESOLVER_API_KEY: config.resolverKey,
      RESOLVER_TIMEOUT_MS: "120000",
      STREAM_CACHE_TTL: "600",
      STREAM_PROXY_SECRET: config.streamSecret,
      TMDB_API_KEY: config.tmdbKey,
      TMDB_LANGUAGE: config.tmdbLanguage,
      TMDB_TIMEOUT_MS: "20000",
      TMDB_CACHE_TTL: "600",
      ROOM_INACTIVE_CLEANUP_HOURS: "12",
      MAX_ROOM_PARTICIPANTS: "50",
    },
  });
  if (await waitForPort(config.apiPort, 90000)) {
    log("ok", `[backend] siap di :${config.apiPort}`);
  } else {
    log("warn", `[backend] belum membuka port ${config.apiPort}; cek log`);
  }

  startChild("frontend", "node", ["node_modules/next/dist/bin/next", "start", "-p", String(config.nextPort)], {
    cwd: path.join(ROOT, "frontend"),
    env: {
      INTERNAL_API_URL: `http://127.0.0.1:${config.apiPort}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  if (await waitForPort(config.nextPort, 90000)) {
    log("ok", `[frontend] siap di :${config.nextPort}`);
  } else {
    log("warn", `[frontend] belum membuka port ${config.nextPort}; cek log`);
  }

  startChild("gateway", "node", [path.join(PANEL_DIR, "gateway.js")], {
    cwd: ROOT,
    env: {
      GATEWAY_PORT: String(config.gatewayPort),
      API_TARGET: `http://127.0.0.1:${config.apiPort}`,
      NEXT_TARGET: `http://127.0.0.1:${config.nextPort}`,
    },
  });
  if (await waitForPort(config.gatewayPort, 30000)) {
    log("ok", `[gateway] siap di :${config.gatewayPort}`);
  }
}

async function healthCheck() {
  const url = `http://127.0.0.1:${config.gatewayPort}/api/health`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const body = await response.json();
        log("ok", `[health] ${JSON.stringify(body).slice(0, 220)}`);
        return true;
      }
    } catch {
      /* belum siap */
    }
    await sleep(1500);
  }
  log("warn", "[health] endpoint /api/health belum menjawab — cek log di deploy/panel/data/logs/");
  return false;
}

/* ---------------------------------- shutdown -------------------------------- */

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("warn", `menerima ${signal}, menghentikan layanan…`);
  for (const record of children.values()) {
    try {
      record.child.kill("SIGTERM");
    } catch {
      /* sudah mati */
    }
  }
  await sleep(1500);
  for (const record of children.values()) {
    try {
      record.child.kill("SIGKILL");
    } catch {
      /* sudah mati */
    }
  }
  if (embeddedPg) {
    try {
      await embeddedPg.stop();
      log("ok", "[db] PostgreSQL dihentikan");
    } catch {
      /* biarkan */
    }
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

/* ----------------------------------- main ----------------------------------- */

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) throw new Error(`Butuh Node.js >= 20 (sekarang ${process.versions.node})`);

  console.log("");
  log("ok", "Nobar King Akbar Anime — mode container (tanpa root)");
  log("info", `proyek: ${ROOT}`);
  log("info", `node ${process.versions.node} · port publik ${config.gatewayPort}`);
  log("info", `sumber anime: ${config.contentSource} · database: ${config.pgMode}`);

  ensureDir(DATA_DIR);
  ensureDir(LOG_DIR);

  await ensureDependencies();
  await ensureBuilds();
  const databaseUrl = await ensureDatabase();
  await startStack(databaseUrl);
  await healthCheck();

  const shown = config.publicUrl || `http://<IP-atau-domain-panel>:${config.gatewayPort}`;
  console.log("");
  log("ok", `SITUS BERJALAN → ${shown}`);
  log("info", "tekan Ctrl+C untuk berhenti · log per layanan ada di deploy/panel/data/logs/");
  console.log("");
}

main().catch(async (error) => {
  log("error", `gagal memulai: ${error?.message || error}`);
  await shutdown("ERROR");
});
