import { query, queryOne } from "../database/pool";

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  avatar_color: string;
  created_at: Date;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  last_seen_at: Date;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  return queryOne<UserRow>("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
}

export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  avatarColor: string;
}): Promise<UserRow> {
  const row = await queryOne<UserRow>(
    `INSERT INTO users (username, email, password_hash, avatar_color)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.username, input.email, input.passwordHash, input.avatarColor]
  );
  if (!row) {
    throw new Error("failed to create user");
  }
  return row;
}

export async function createSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [input.userId, input.tokenHash, input.expiresAt]
  );
}

export async function findValidSession(tokenHash: string): Promise<(SessionRow & { user: UserRow }) | null> {
  const row = await queryOne<{
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    last_seen_at: Date;
    u_id: string;
    username: string;
    email: string;
    password_hash: string;
    avatar_color: string;
    u_created_at: Date;
  }>(
    `SELECT s.id, s.user_id, s.token_hash, s.expires_at, s.last_seen_at,
            u.id AS u_id, u.username, u.email, u.password_hash, u.avatar_color,
            u.created_at AS u_created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash]
  );
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    token_hash: row.token_hash,
    expires_at: row.expires_at,
    last_seen_at: row.last_seen_at,
    user: {
      id: row.u_id,
      username: row.username,
      email: row.email,
      password_hash: row.password_hash,
      avatar_color: row.avatar_color,
      created_at: row.u_created_at,
    },
  };
}

export async function touchSession(sessionId: string): Promise<void> {
  await query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [sessionId]);
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}

export async function deleteExpiredSessions(): Promise<number> {
  const rows = await query<{ count: string }>(
    `WITH deleted AS (DELETE FROM sessions WHERE expires_at <= now() RETURNING 1)
     SELECT count(*)::text AS count FROM deleted`
  );
  return Number(rows[0]?.count ?? 0);
}
