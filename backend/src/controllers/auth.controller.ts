import type { Request, Response } from "express";
import { z } from "zod";
import { errors } from "../domain/errors";
import { clearSessionCookie, setSessionCookie } from "../middleware/auth";
import * as authService from "../services/auth.service";
import { parseOrThrow } from "../utils/validate";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(24, "Username maksimal 24 karakter.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore."),
  email: z.string().trim().email("Email tidak valid.").max(160),
  password: z.string().min(8, "Password minimal 8 karakter.").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid.").max(160),
  password: z.string().min(1, "Password wajib diisi.").max(72),
});

export async function register(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(registerSchema, req.body ?? {});
  const { user, token } = await authService.register(input);
  setSessionCookie(req, res, token);
  res.status(201).json({ status: "success", data: { user } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(loginSchema, req.body ?? {});
  const { user, token } = await authService.login(input);
  setSessionCookie(req, res, token);
  res.status(200).json({ status: "success", data: { user } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.sessionToken);
  clearSessionCookie(req, res);
  res.status(200).json({ status: "success", data: { loggedOut: true } });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw errors.unauthorized();
  }
  res.status(200).json({ status: "success", data: { user: req.user } });
}
