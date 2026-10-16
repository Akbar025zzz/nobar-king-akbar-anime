import type { Request, Response } from "express";
import { query } from "../database/pool";
import { liveRoomCount } from "../services/stats.service";

export async function health(_req: Request, res: Response): Promise<void> {
  let db: "up" | "down" = "down";
  try {
    await query("SELECT 1");
    db = "up";
  } catch {
    db = "down";
  }

  res.status(200).json({
    status: "success",
    data: {
      ok: db === "up",
      service: "nobar-king-backend",
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      db,
    },
  });
}

export async function liveCount(_req: Request, res: Response): Promise<void> {
  const rooms = await liveRoomCount();
  res.status(200).json({ status: "success", data: { rooms } });
}
