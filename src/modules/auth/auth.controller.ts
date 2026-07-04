import { Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { AUTH_COOKIE_NAME } from '../../middlewares/auth.middleware';
import { loginSchema } from './auth.schema';
import * as authService from './auth.service';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const { token, user } = await authService.login(result.data);

  res.cookie(AUTH_COOKIE_NAME, token, { ...cookieOptions(), maxAge: TWO_HOURS_MS });
  res.json(user);
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
  res.status(200).json({ ok: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json(user);
});
