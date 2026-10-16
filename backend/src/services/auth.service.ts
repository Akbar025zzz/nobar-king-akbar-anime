import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import type { UserDTO } from "../domain/contracts";
import { errors } from "../domain/errors";
import {
  createSession,
  createUser,
  deleteSessionByTokenHash,
  findUserByEmail,
  findUserByUsername,
  findValidSession,
  touchSession,
  type UserRow,
} from "../repositories/users.repo";

const AVATAR_COLORS = ["#55CBD8", "#7C6CF6", "#FF5D73", "#FFB020", "#37D67A", "#F472B6"];

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function toUserDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarColor: row.avatar_color,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function issueSession(userId: string): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + env.session.ttlDays * 24 * 60 * 60 * 1000);
  await createSession({ userId, tokenHash: hashToken(token), expiresAt });
  return token;
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}): Promise<{ user: UserDTO; token: string }> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  if (await findUserByEmail(email)) {
    throw errors.validation("Email sudah terdaftar.");
  }
  if (await findUserByUsername(username)) {
    throw errors.validation("Username sudah dipakai.");
  }

  const passwordHash = await bcrypt.hash(input.password, 11);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? AVATAR_COLORS[0];
  const user = await createUser({ username, email, passwordHash, avatarColor });
  const token = await issueSession(user.id);
  return { user: toUserDTO(user), token };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: UserDTO; token: string }> {
  const user = await findUserByEmail(input.email.trim().toLowerCase());
  if (!user) {
    throw errors.unauthorized("Email atau password salah.");
  }
  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw errors.unauthorized("Email atau password salah.");
  }
  const token = await issueSession(user.id);
  return { user: toUserDTO(user), token };
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return;
  await deleteSessionByTokenHash(hashToken(token));
}

export async function authenticate(token: string | null): Promise<UserDTO | null> {
  if (!token) return null;
  const session = await findValidSession(hashToken(token));
  if (!session) return null;
  void touchSession(session.id).catch(() => undefined);
  return toUserDTO(session.user);
}
