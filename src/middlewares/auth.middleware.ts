import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { AuthUser } from '../types/express';

export const AUTH_COOKIE_NAME = 'auth_token';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    next(new ApiError(401, 'No autenticado'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = { id: payload.id, nombre: payload.nombre, rolId: payload.rolId };
    next();
  } catch {
    next(new ApiError(401, 'Sesión inválida o expirada'));
  }
}
