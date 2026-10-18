const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;

function loadRootEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadRootEnv();

// Pterodactyl menyediakan allocation sebagai SERVER_PORT. Jangan mengubah
// port dari aplikasi; ikuti port yang sudah ditetapkan panel.
const port = process.env.SERVER_PORT || process.env.PORT || "3000";
const publicUrl = process.env.PUBLIC_URL || `http://127.0.0.1:${port}`;
const secureCookies = publicUrl.startsWith("https://");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[pterodactyl] DATABASE_URL wajib diisi pada Startup > Variables.");
  process.exit(1);
}

const commonEnv = {
  ...process.env,
  NODE_ENV: "production",
  FRONTEND_URL: publicUrl,
  CORS_ORIGINS: process.env.CORS_ORIGINS || publicUrl,
  DATABASE_URL: databaseUrl,
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE || String(secureCookies),
  SESSION_COOKIE_SAMESITE: process.env.SESSION_COOKIE_SAMESITE || (secureCookies ? "none" : "lax"),
  WAJIK_API_URL: process.env.WAJIK_API_URL || "http://127.0.0.1:4200",
  RESOLVER_API_URL: process.env.RESOLVER_API_URL || "http://127.0.0.1:4100/api/v1/anime",
  RESOLVER_API_KEY: process.env.RESOLVER_API_KEY || "nobar-internal-dev-key",
};

const projects = ["backend", "wajik-anime-api", "anime1v-api", "frontend"];
for (const project of projects) {
  const cwd = path.join(root, project);
  if (!fs.existsSync(path.join(cwd, "node_modules"))) {
    console.log(`[pterodactyl] installing ${project} dependencies...`);
    execFileSync("npm", ["ci", "--no-audit", "--no-fund"], {
      cwd,
      env: commonEnv,
      stdio: "inherit",
    });
  } else {
    console.log(`[pterodactyl] ${project} dependencies already installed; skipping npm ci.`);
  }
}

const children = [];
let shuttingDown = false;

function launch(label, cwd, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: path.join(root, cwd),
    env: { ...commonEnv, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[pterodactyl] ${label} berhenti: code=${code} signal=${signal || "-"}`);
      shutdown(code || 1);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 5000).unref();
}

async function waitForBackend() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4000/api/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Backend tidak ready setelah 60 detik.");
}

async function main() {
  launch("backend", "backend", "npx", ["tsx", "src/index.ts"], { PORT: "4000" });
  launch("wajik", "wajik-anime-api", "npx", ["tsx", "-r", "tsconfig-paths/register", "src/index.ts"], { PORT: "4200" });
  launch("resolver", "anime1v-api", "node", ["src/server.js"], { PORT: "4100", API_KEY: commonEnv.RESOLVER_API_KEY });

  await waitForBackend();
  console.log("[pterodactyl] backend ready; building frontend...");
  execFileSync("npm", ["run", "build"], {
    cwd: path.join(root, "frontend"),
    env: { ...commonEnv, INTERNAL_API_URL: "http://127.0.0.1:4000" },
    stdio: "inherit",
  });
  launch("frontend", "frontend", "npm", ["run", "start", "--", "-p", String(port)], {
    PORT: String(port),
    INTERNAL_API_URL: "http://127.0.0.1:4000",
  });
  console.log(`[pterodactyl] Nobar King Akbar siap di port ${port}`);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
main().catch((error) => {
  console.error("[pterodactyl] startup gagal:", error);
  shutdown(1);
});
