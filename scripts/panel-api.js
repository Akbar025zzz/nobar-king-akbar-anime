/* Otomasi panel Pterodactyl lewat Client API.
 *
 * Kunci API dibaca dari /home/ubuntu/panel-access.env  (baris PANEL_API_KEY=ptlc_...).
 * Panel dilindungi Cloudflare, tetapi endpoint /api/client/* tidak terkena tantangan,
 * jadi seluruh pekerjaan (unggah berkas, jalankan server, baca hasil) bisa otomatis.
 *
 * Pemakaian:
 *   node scripts/panel-api.js servers
 *   node scripts/panel-api.js detail <serverId>
 *   node scripts/panel-api.js status <serverId>
 *   node scripts/panel-api.js power <serverId> start|stop|restart|kill
 *   node scripts/panel-api.js write <serverId> /path.txt "isi teks"
 *   node scripts/panel-api.js upload <serverId> <berkasLokal> /direktori/
 *   node scripts/panel-api.js read <serverId> /path.txt
 *   node scripts/panel-api.js ls <serverId> /direktori
 *   node scripts/panel-api.js vars <serverId>
 *   node scripts/panel-api.js setvar <serverId> KEY value
 *   node scripts/panel-api.js dbs <serverId>
 *   node scripts/panel-api.js mkdb <serverId> nama_db
 */
const fs = require("node:fs");
const path = require("node:path");

const envText = fs.readFileSync("/home/ubuntu/panel-access.env", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

const BASE = `${env.PANEL_URL}/api/client`;
const KEY = env.PANEL_API_KEY;
if (!KEY) {
  console.error("PANEL_API_KEY belum ada di /home/ubuntu/panel-access.env");
  process.exit(1);
}

async function api(method, endpoint, body) {
  const response = await fetch(`${BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    console.error(`HTTP ${response.status} ${endpoint}`);
    console.error(typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

async function uploadFile(serverId, localPath, directory) {
  const signed = await api("GET", `/servers/${serverId}/files/upload?directory=${encodeURIComponent(directory)}`);
  const url = signed?.attributes?.url;
  if (!url) throw new Error("URL unggah tidak diterima");

  const fileBuffer = fs.readFileSync(localPath);
  const form = new FormData();
  form.append("files", new Blob([fileBuffer]), path.basename(localPath));
  const response = await fetch(url, { method: "POST", body: form });
  if (!response.ok) throw new Error(`unggah gagal: HTTP ${response.status} ${await response.text()}`);
  return true;
}

(async () => {
  const [command, serverId, arg1, arg2] = process.argv.slice(2);

  switch (command) {
    case "servers": {
      const list = await api("GET", "");
      for (const server of list.data) {
        const a = server.attributes;
        console.log(
          [
            a.identifier,
            a.name,
            `state=${a.status ?? "-"}`,
            a.limits?.memory ? `ram=${a.limits.memory}MB` : "",
            a.limits?.disk ? `disk=${a.limits.disk}MB` : "",
            a.limits?.cpu ? `cpu=${a.limits.cpu}%` : "",
          ]
            .filter(Boolean)
            .join(" | ")
        );
      }
      break;
    }
    case "detail": {
      const data = await api("GET", `/servers/${serverId}`);
      console.log(JSON.stringify(data.attributes, null, 2).slice(0, 4000));
      break;
    }
    case "status": {
      const data = await api("GET", `/servers/${serverId}/resources`);
      const a = data.attributes;
      console.log(
        `state=${a.current_state} cpu=${a.resources.cpu_absolute}% ram=${Math.round(
          a.resources.memory_bytes / 1024 / 1024
        )}MB disk=${Math.round(a.resources.disk_bytes / 1024 / 1024)}MB uptime=${a.resources.uptime}ms`
      );
      break;
    }
    case "power": {
      const data = await api("POST", `/servers/${serverId}/power`, { signal: arg1 });
      console.log("sinyal dikirim:", arg1, data ? JSON.stringify(data) : "");
      break;
    }
    case "write": {
      const response = await fetch(`${BASE}/servers/${serverId}/files/write?file=${encodeURIComponent(arg1)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "text/plain" },
        body: arg2 ?? "",
      });
      console.log("tulis:", response.status);
      break;
    }
    case "upload": {
      await uploadFile(serverId, arg1, arg2 || "/");
      console.log("unggah selesai:", path.basename(arg1), "→", arg2 || "/");
      break;
    }
    case "read": {
      const response = await fetch(`${BASE}/servers/${serverId}/files/contents?file=${encodeURIComponent(arg1)}`, {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      console.log(await response.text());
      break;
    }
    case "ls": {
      const data = await api("GET", `/servers/${serverId}/files/list?directory=${encodeURIComponent(arg1 || "/")}`);
      for (const file of data.data) {
        const a = file.attributes;
        console.log(`${a.is_file ? "file" : "dir "} ${String(a.size).padStart(10)} ${a.name}`);
      }
      break;
    }
    case "vars": {
      const data = await api("GET", `/servers/${serverId}/startup`);
      for (const variable of data.data) {
        console.log(`${variable.attributes.env_variable} = ${JSON.stringify(variable.attributes.server_value)}`);
      }
      break;
    }
    case "setvar": {
      const data = await api("PUT", `/servers/${serverId}/startup/variable`, { key: arg1, value: arg2 ?? "" });
      console.log("variabel diset:", JSON.stringify(data.attributes ?? data).slice(0, 200));
      break;
    }
    case "dbs": {
      const data = await api("GET", `/servers/${serverId}/databases`);
      if (!data.data.length) console.log("(belum ada database)");
      for (const db of data.data) {
        const a = db.attributes;
        console.log(`${a.name} | host=${a.host.address}:${a.host.port} | user=${a.username} | ${a.connections_from}`);
      }
      break;
    }
    case "mkdb": {
      const data = await api("POST", `/servers/${serverId}/databases`, {
        database: arg1,
        remote: "%",
      });
      console.log(JSON.stringify(data.attributes ?? data, null, 2).slice(0, 800));
      break;
    }
    default:
      console.log("perintah tidak dikenal:", command);
  }
})().catch((error) => {
  console.error("GAGAL:", error.message);
  process.exit(1);
});
