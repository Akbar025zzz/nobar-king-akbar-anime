import type { Request, Response } from "express";
import { z } from "zod";
import { errors } from "../domain/errors";
import { roomBus } from "../realtime/bus";
import * as roomService from "../services/room.service";
import { parseOrThrow } from "../utils/validate";

const createRoomSchema = z.object({
  contentId: z.string().trim().min(1, "contentId wajib diisi.").max(200),
  episodeId: z.string().trim().min(1).max(200).nullish(),
  roomName: z.string().trim().min(1).max(120).optional(),
  privacy: z.enum(["public", "private"]).optional(),
});

const episodeSchema = z.object({
  episodeId: z.string().trim().min(1, "episodeId wajib diisi.").max(200),
});

function requireUser(req: Request) {
  if (!req.user) {
    throw errors.unauthorized();
  }
  return req.user;
}

export async function createRoom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const input = parseOrThrow(createRoomSchema, req.body ?? {});
  const room = await roomService.createRoom(user, input);
  res.status(201).json({ status: "success", data: room });
}

export async function liveRooms(_req: Request, res: Response): Promise<void> {
  const rooms = await roomService.listLiveRooms();
  res.status(200).json({ status: "success", data: rooms, meta: { count: rooms.length } });
}

export async function myRooms(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const rooms = await roomService.listRoomsForUser(user.id);
  res.status(200).json({ status: "success", data: rooms, meta: { count: rooms.length } });
}

export async function getRoom(req: Request, res: Response): Promise<void> {
  const room = await roomService.getRoom(req.params.id, req.user);
  res.status(200).json({ status: "success", data: room });
}

export async function endRoom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const result = await roomService.endRoom(user, req.params.id);
  roomBus.emit("room:end", { roomId: req.params.id });
  res.status(200).json({ status: "success", data: result });
}

export async function changeEpisode(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { episodeId } = parseOrThrow(episodeSchema, req.body ?? {});
  const result = await roomService.changeEpisode(user, req.params.id, episodeId);
  roomBus.emit("room:episode", {
    roomId: req.params.id,
    room: result.room,
    episode: result.episode,
  });
  res.status(200).json({ status: "success", data: result });
}

export async function messages(req: Request, res: Response): Promise<void> {
  const messages = await roomService.listRoomMessages(req.params.id, req.user);
  res.status(200).json({ status: "success", data: messages, meta: { count: messages.length } });
}
