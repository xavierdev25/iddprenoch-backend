import { Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { AUTH_COOKIE_NAME } from '../../middlewares/auth.middleware';
import { recursoDe, registrarAuditoria } from '../../utils/auditoria';
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

  let sesion: Awaited<ReturnType<typeof authService.login>>;
  try {
    sesion = await authService.login(result.data);
  } catch (err) {
    // Se guarda el nombre con que se intentó: sin él, un intento de fuerza bruta no se distingue
    // de un usuario que olvidó su clave. La contraseña, nunca.
    await registrarAuditoria({
      usuarioNombre: result.data.nombre,
      accion: 'LOGIN',
      recurso: recursoDe(req),
      resultado: 'DENEGADO',
      detalle: err instanceof ApiError ? err.message : 'error inesperado',
      ip: req.ip,
    });
    throw err;
  }
  const { token, user } = sesion;

  await registrarAuditoria({
    usuarioId: user.id,
    usuarioNombre: user.nombre,
    accion: 'LOGIN',
    recurso: recursoDe(req),
    resultado: 'PERMITIDO',
    ip: req.ip,
  });

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
