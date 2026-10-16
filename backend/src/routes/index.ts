import { Router } from "express";
import { env } from "../config/env";
import * as animeController from "../controllers/anime.controller";
import * as authController from "../controllers/auth.controller";
import * as metaController from "../controllers/meta.controller";
import * as roomController from "../controllers/room.controller";
import * as userController from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { asyncHandler } from "../utils/asyncHandler";

export const apiRouter = Router();

/* ------------------------------- meta ------------------------------- */
apiRouter.get("/health", asyncHandler(metaController.health));
apiRouter.get("/meta/live-count", asyncHandler(metaController.liveCount));

/* ------------------------------- anime ------------------------------ */
apiRouter.get(
  "/anime/search",
  rateLimit({ name: "search", limit: env.rateLimits.searchPerMin, windowMs: 60_000 }),
  asyncHandler(animeController.search)
);
apiRouter.get("/anime/ongoing", asyncHandler(animeController.ongoing));
apiRouter.get("/anime/complete", asyncHandler(animeController.complete));
apiRouter.get("/anime/trending", asyncHandler(animeController.trending));
apiRouter.get("/anime/genres", asyncHandler(animeController.genres));
apiRouter.get("/anime", asyncHandler(animeController.getCatalog));
apiRouter.get(
  "/anime/:id/episodes/:episodeId/stream",
  rateLimit({ name: "stream", limit: env.rateLimits.streamPerMin, windowMs: 60_000 }),
  asyncHandler(animeController.stream)
);
apiRouter.get("/anime/:id/episodes", asyncHandler(animeController.episodes));
apiRouter.get("/anime/:id", asyncHandler(animeController.detail));

/* -------------------------- stream proxy ---------------------------- */
// Signed pass-through for stream bytes (playlists/segments). No rate limit:
// a single playback issues many segment requests.
apiRouter.get("/stream/proxy", asyncHandler(animeController.streamProxy));

/* ------------------------------- auth ------------------------------- */
apiRouter.post(
  "/auth/register",
  rateLimit({ name: "register", limit: env.rateLimits.registerPerHour, windowMs: 3_600_000 }),
  asyncHandler(authController.register)
);
apiRouter.post(
  "/auth/login",
  rateLimit({ name: "login", limit: env.rateLimits.loginPer15Min, windowMs: 900_000 }),
  asyncHandler(authController.login)
);
apiRouter.post("/auth/logout", asyncHandler(authController.logout));
apiRouter.get("/auth/me", asyncHandler(authController.me));

/* ------------------------------- rooms ------------------------------ */
apiRouter.get("/rooms/live", asyncHandler(roomController.liveRooms));
apiRouter.get("/rooms/mine", requireAuth, asyncHandler(roomController.myRooms));
apiRouter.post(
  "/rooms",
  requireAuth,
  rateLimit({ name: "create-room", limit: env.rateLimits.createRoomPerHour, windowMs: 3_600_000 }),
  asyncHandler(roomController.createRoom)
);
apiRouter.get("/rooms/:id", asyncHandler(roomController.getRoom));
apiRouter.post("/rooms/:id/end", requireAuth, asyncHandler(roomController.endRoom));
apiRouter.post("/rooms/:id/episode", requireAuth, asyncHandler(roomController.changeEpisode));
apiRouter.get("/rooms/:id/messages", asyncHandler(roomController.messages));

/* --------------------------- user library --------------------------- */
apiRouter.get("/me/favorites", requireAuth, asyncHandler(userController.listFavorites));
apiRouter.post("/me/favorites", requireAuth, asyncHandler(userController.addFavorite));
apiRouter.delete("/me/favorites/:contentId", requireAuth, asyncHandler(userController.removeFavorite));
apiRouter.get("/me/history", requireAuth, asyncHandler(userController.listHistory));
apiRouter.post("/me/history", requireAuth, asyncHandler(userController.recordHistory));
apiRouter.delete("/me/history", requireAuth, asyncHandler(userController.clearHistory));
apiRouter.delete("/me/history/:contentId", requireAuth, asyncHandler(userController.removeHistoryEntry));
