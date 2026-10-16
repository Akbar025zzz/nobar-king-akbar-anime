"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Single shared Socket.IO connection. Connects to the same origin by default
 * (gateway / Next rewrites proxy /socket.io to the backend); cookies are sent
 * automatically for session auth.
 */
export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
    socket = io(url, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}
