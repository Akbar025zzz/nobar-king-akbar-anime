import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { attachRoomHub } from "./roomHub";

function allowedOrigins(): string[] {
  const origins = new Set<string>();
  origins.add(env.frontendUrl);
  for (const origin of env.corsOrigins) {
    origins.add(origin);
  }
  // local development conveniences
  origins.add("http://localhost:3000");
  origins.add("http://localhost:3001");
  origins.add("http://127.0.0.1:3000");
  origins.add("http://127.0.0.1:3001");
  return Array.from(origins);
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        callback(null, allowedOrigins().includes(origin));
      },
      credentials: true,
    },
  });

  attachRoomHub(io);
  return io;
}
