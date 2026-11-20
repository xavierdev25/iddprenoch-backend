import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

/**
 * Sesión del elector (ADR-029): separada de la del panel en todo.
 *
 * - Otra cookie (`elector_token`), restringida a `/api/votacion`: el navegador ni siquiera la manda
 *   al resto de la API.
 * - Otra clave de firma, derivada de JWT_SECRET: un token de elector no valida como token de
 *   administrador ni al revés, aunque alguien copie uno en la cookie del otro. Así no hace falta
 *   cambiar el contrato del JWT del panel (ADR-026).
 * - Ligada a una asamblea y corta: 8 h, lo que dura una jornada de asamblea.
 */
export const ELECTOR_COOKIE = 'elector_token';
const DURACION_MS = 8 * 60 * 60 * 1000;
const RUTA_COOKIE = '/api/votacion';

function clave(): string {
  return `${env.JWT_SECRET}:elector`;
}

export interface SesionElector {
  electorId: number;
  asambleaId: number;
  /** Momento de la acreditación: si la mesa regenera el código, las sesiones anteriores caducan. */
  acreditadoEn?: number;
}

declare global {
  namespace Express {
    interface Request {
      elector?: SesionElector;
    }
  }
}

function opcionesCookie() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env.COOKIE_SECURE, path: RUTA_COOKIE };
}

export function abrirSesionElector(res: Response, sesion: SesionElector): void {
  const token = jwt.sign({ e: sesion.electorId, a: sesion.asambleaId, t: sesion.acreditadoEn }, clave(), {
    expiresIn: '8h',
  });
  res.cookie(ELECTOR_COOKIE, token, { ...opcionesCookie(), maxAge: DURACION_MS });
}

export function cerrarSesionElector(res: Response): void {
  res.clearCookie(ELECTOR_COOKIE, opcionesCookie());
}

export function leerSesionElector(token: string | undefined): SesionElector | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, clave()) as { e?: unknown; a?: unknown; t?: unknown };
    if (typeof p.e !== 'number' || typeof p.a !== 'number') return null;
    return { electorId: p.e, asambleaId: p.a, acreditadoEn: typeof p.t === 'number' ? p.t : undefined };
  } catch {
    return null;
  }
}

/** Exige sesión de elector. La pertenencia a la asamblea del código la valida cada handler. */
export function requireElector(req: Request, _res: Response, next: NextFunction) {
  const sesion = leerSesionElector(req.cookies?.[ELECTOR_COOKIE]);
  if (!sesion) {
    next(new ApiError(401, 'Tu sesión terminó. Vuelve a ingresar con tu DNI y tu código.'));
    return;
  }
  req.elector = sesion;
  next();
}
