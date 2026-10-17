#!/usr/bin/env node
/*
 * Titik masuk untuk hosting container (Pterodactyl/egg Node.js).
 * Startup command panel cukup:  node start-panel.js
 *
 * Skrip ini hanya meneruskan ke deploy/panel/start.mjs yang menjalankan
 * PostgreSQL embedded + wajik-anime-api + resolver + backend + frontend + gateway.
 */
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const target = pathToFileURL(path.join(__dirname, "deploy", "panel", "start.mjs")).href;

import(target).catch((error) => {
  console.error("[start-panel] gagal:", error?.message || error);
  process.exit(1);
});
