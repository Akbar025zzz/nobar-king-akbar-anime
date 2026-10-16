import { env } from "../config/env";
import { countLivePublicRooms } from "../repositories/rooms.repo";
import { cleanupInactiveRooms } from "../repositories/rooms.repo";
import { deleteExpiredSessions } from "../repositories/users.repo";
import { logger } from "../utils/logger";

export async function liveRoomCount(): Promise<number> {
  return countLivePublicRooms();
}

async function runCleanup(): Promise<void> {
  try {
    const roomsEnded = await cleanupInactiveRooms(env.rooms.inactiveCleanupHours);
    const sessionsDeleted = await deleteExpiredSessions();
    if (roomsEnded > 0 || sessionsDeleted > 0) {
      logger.info("maintenance cleanup", { roomsEnded, sessionsDeleted });
    }
  } catch (error) {
    logger.error("maintenance cleanup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

let maintenanceTimer: NodeJS.Timeout | null = null;

export function startMaintenanceJobs(): void {
  if (maintenanceTimer) return;
  maintenanceTimer = setInterval(() => {
    void runCleanup();
  }, 30 * 60 * 1000);
  maintenanceTimer.unref();
  logger.info("maintenance jobs started", {
    cleanupIntervalMinutes: 30,
    inactiveRoomHours: env.rooms.inactiveCleanupHours,
  });
}
