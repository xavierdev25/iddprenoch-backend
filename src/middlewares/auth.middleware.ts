import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { auditar } from '../utils/auditoria';
import { Permiso, tienePermiso } from '../utils/permisos';
import { JwtPayload } from '../types/express';

export const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Verifica el JWT y resuelve el usuario desde la base (ADR-026).
 *
 * El token solo prueba *quién* es; rol, distrito y estado se leen en cada request para que una
 * desactivación o un cambio de rol rijan al instante y no recién cuando venza el token (2 h).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    next(new ApiError(401, 'No autenticado'));
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    next(new ApiError(401, 'Sesión inválida o expirada'));
    return;
  }

  prisma.usuario
    .findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        nombre: true,
        rolId: true,
        distritoId: true,
        rol: { select: { nombre: true } },
        estado: { select: { nombre: true } },
      },
    })
    .then((usuario) => {
      if (!usuario || usuario.estado.nombre !== 'Activo') {
        next(new ApiError(401, 'Sesión inválida o usuario inactivo'));
        return;
      }
      req.user = {
        id: usuario.id,
        nombre: usuario.nombre,
        rolId: usuario.rolId,
        rol: usuario.rol.nombre,
        distritoId: usuario.distritoId,
      };
      next();
    })
    .catch(next);
}

/**
 * Exige un permiso de la matriz (ver utils/permisos.ts). Va después de `requireAuth`. Un rechazo
 * responde 403 y queda en la auditoría: es exactamente el acceso denegado que pide HU05.
 */
export function requirePermiso(permiso: Permiso) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      next(new ApiError(401, 'No autenticado'));
      return;
    }
    if (tienePermiso(user.rol, permiso)) {
      next();
      return;
    }
    auditar(req, `${req.method} ${permiso}`, 'DENEGADO', `Rol "${user.rol}" sin permiso "${permiso}"`)
      .finally(() => next(new ApiError(403, 'No tienes permiso para realizar esta acción')));
  };
}

/** Atajo: sesión válida + permiso, en el orden correcto. */
export function requireAuthYPermiso(permiso: Permiso) {
  const conPermiso = requirePermiso(permiso);
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: unknown) => (err ? next(err) : conPermiso(req, res, next)));
  };
}

/**
 * Para los GET que comparten el sitio público y el panel (iglesias, pastores).
 *
 * Sin `?ambito=panel` la request sigue siendo pública y anónima: no se lee la cookie, así que un
 * obispo distrital con sesión abierta ve el sitio público completo y no una versión filtrada. Con
 * `?ambito=panel` se exige sesión y permiso, y los controladores aplican el alcance del usuario.
 */
export function vistaPanel(permiso: Permiso) {
  const exigir = requireAuthYPermiso(permiso);
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.query.ambito !== 'panel') {
      next();
      return;
    }
    // La respuesta del panel depende del usuario: que ninguna caché compartida la reutilice.
    res.set('Cache-Control', 'private, no-cache');
    exigir(req, res, next);
  };
}
