import { query, queryOne } from "../database/pool";
import { sourceFromContentId } from "../adapters/wajik/wajik.adapter";

export interface RoomRow {
  id: string;
  host_id: string;
  source: string;
  content_type: string;
  content_id: string;
  content_url: string | null;
  episode_id: string | null;
  episode_url: string | null;
  room_name: string;
  privacy: "public" | "private";
  is_active: boolean;
  playback_state: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface ParticipantRow {
  room_id: string;
  user_id: string;
  joined_at: Date;
  last_seen: Date;
  username: string;
  avatar_color: string;
}

export interface MessageRow {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: Date;
  username: string;
  avatar_color: string;
}

export async function createRoom(input: {
  hostId: string;
  contentId: string;
  contentUrl: string | null;
  episodeId: string | null;
  episodeUrl: string | null;
  roomName: string;
  privacy: "public" | "private";
}): Promise<RoomRow> {
  const row = await queryOne<RoomRow>(
    `INSERT INTO rooms
     (host_id, source, content_type, content_id, content_url, episode_id, episode_url, room_name, privacy)
     VALUES ($1, $8, 'anime', $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.hostId,
      input.contentId,
      input.contentUrl,
      input.episodeId,
      input.episodeUrl,
      input.roomName,
      input.privacy,
      sourceFromContentId(input.contentId),
    ]
  );
  if (!row) throw new Error("failed to create room");
  return row;
}

export async function getRoomById(id: string): Promise<RoomRow | null> {
  return queryOne<RoomRow>(`SELECT * FROM rooms WHERE id = $1`, [id]);
}

export async function listLiveRooms(limit = 24): Promise<RoomRow[]> {
  return query<RoomRow>(
    `SELECT * FROM rooms
     WHERE is_active = true AND privacy = 'public'
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function listRoomsForUser(userId: string, limit = 30): Promise<RoomRow[]> {
  return query<RoomRow>(
    `SELECT DISTINCT r.*
     FROM rooms r
     LEFT JOIN room_participants p ON p.room_id = r.id
     WHERE r.host_id = $1 OR p.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export async function endRoom(roomId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE rooms SET is_active = false, updated_at = now() WHERE id = $1 AND is_active = true RETURNING id`,
    [roomId]
  );
  return rows.length > 0;
}

export async function touchRoom(roomId: string): Promise<void> {
  await query(`UPDATE rooms SET updated_at = now() WHERE id = $1`, [roomId]);
}

export async function updateRoomEpisode(
  roomId: string,
  episodeId: string | null,
  episodeUrl: string | null
): Promise<void> {
  await query(
    `UPDATE rooms SET episode_id = $2, episode_url = $3, updated_at = now() WHERE id = $1`,
    [roomId, episodeId, episodeUrl]
  );
}

export async function updateRoomHost(roomId: string, hostId: string): Promise<void> {
  await query(`UPDATE rooms SET host_id = $2, updated_at = now() WHERE id = $1`, [roomId, hostId]);
}

export async function updatePlaybackState(roomId: string, state: unknown): Promise<void> {
  await query(`UPDATE rooms SET playback_state = $2::jsonb, updated_at = now() WHERE id = $1`, [
    roomId,
    JSON.stringify(state),
  ]);
}

export async function addOrTouchParticipant(roomId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO room_participants (room_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = now()`,
    [roomId, userId]
  );
}

export async function touchParticipant(roomId: string, userId: string): Promise<void> {
  await query(`UPDATE room_participants SET last_seen = now() WHERE room_id = $1 AND user_id = $2`, [
    roomId,
    userId,
  ]);
}

export async function listParticipants(roomId: string): Promise<ParticipantRow[]> {
  return query<ParticipantRow>(
    `SELECT p.room_id, p.user_id, p.joined_at, p.last_seen, u.username, u.avatar_color
     FROM room_participants p JOIN users u ON u.id = p.user_id
     WHERE p.room_id = $1
     ORDER BY p.joined_at ASC`,
    [roomId]
  );
}

export async function addMessage(roomId: string, userId: string, message: string): Promise<MessageRow> {
  const row = await queryOne<MessageRow>(
    `INSERT INTO room_messages (room_id, user_id, message)
     VALUES ($1, $2, $3)
     RETURNING id, room_id, user_id, message, created_at, '' AS username, '' AS avatar_color`,
    [roomId, userId, message]
  );
  if (!row) throw new Error("failed to save message");
  return row;
}

export async function listMessages(roomId: string, limit = 60): Promise<MessageRow[]> {
  const rows = await query<MessageRow>(
    `SELECT m.id, m.room_id, m.user_id, m.message, m.created_at, u.username, u.avatar_color
     FROM room_messages m JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [roomId, limit]
  );
  return rows.reverse();
}

export async function cleanupInactiveRooms(inactiveHours: number): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE rooms SET is_active = false, updated_at = now()
     WHERE is_active = true AND updated_at < now() - ($1 || ' hours')::interval
     RETURNING id`,
    [String(inactiveHours)]
  );
  return rows.length;
}

export async function countLivePublicRooms(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM rooms WHERE is_active = true AND privacy = 'public'`
  );
  return Number(row?.count ?? 0);
}
