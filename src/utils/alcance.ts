import { Request } from 'express';
import { prisma } from '../db/prisma';
import { ApiError } from './ApiError';
import { auditar } from './auditoria';
import { distritoDeAlcance } from './permisos';

/**
 * Alcance territorial del obispo distrital (ADR-026, HU02/HU03).
 *
 * Todo dato de membresía cuelga de una iglesia, y la iglesia de un distrito: el alcance se expresa
 * siempre como `iglesia.distritoId = user.distritoId`. Para el resto de roles (alcance regional)
 * estas funciones no agregan ninguna condición.
 */

/** Distrito al que queda acotada la request, o `null` si es regional o anónima (vista pública). */
export function distritoDe(req: Request): number | null {
  return req.user ? distritoDeAlcance(req.user) : null;
}

/** Condición sobre la tabla `iglesias`. */
export function whereIglesiaEnAlcance(req: Request): Record<string, unknown> {
  const distrito = distritoDe(req);
  return distrito === null ? {} : { distritoId: distrito };
}

/** Condición sobre una tabla con `iglesiaId` (congregantes, pastores, líderes). */
export function whereRelacionIglesiaEnAlcance(req: Request): Record<string, unknown> {
  const distrito = distritoDe(req);
  return distrito === null ? {} : { iglesia: { distritoId: distrito } };
}

/** Corta con 403 y deja constancia en la auditoría. */
async function denegar(req: Request, detalle: string): Promise<never> {
  await auditar(req, `${req.method} fuera de alcance`, 'DENEGADO', detalle);
  throw new ApiError(403, 'Ese registro pertenece a otro distrito: está fuera de tu alcance');
}

/**
 * Exige que un distrito esté dentro del alcance. `undefined` (no se pudo determinar el distrito,
 * p. ej. una iglesia inexistente) cuenta como fuera de alcance para el obispo distrital: ante la
 * duda se deniega, no se deja pasar.
 */
export async function exigirDistritoEnAlcance(req: Request, distritoId: number | null | undefined): Promise<void> {
  const distrito = distritoDe(req);
  if (distrito === null || distritoId === distrito) return;
  await denegar(req, `Distrito del registro: ${distritoId ?? 'desconocido'}; distrito del usuario: ${distrito}`);
}

/** Distrito de una iglesia, o `undefined` si no existe. */
export async function distritoDeIglesia(iglesiaId: number): Promise<number | undefined> {
  const iglesia = await prisma.iglesia.findUnique({ where: { id: iglesiaId }, select: { distritoId: true } });
  return iglesia?.distritoId;
}

/**
 * Aplica el alcance a los filtros de congregantes/reportes (los comparten, ver
 * congregantes.filters.ts), en vez de sumar un `where` aparte: así el distrito forzado también
 * aparece en la cabecera del Excel/PDF y en las filas vacías del consolidado.
 *
 * Pedir explícitamente otro distrito, o una iglesia de otro distrito, no se resuelve con una lista
 * vacía sino con 403: es un intento de acceso fuera de alcance y debe quedar auditado.
 */
export async function aplicarAlcanceAFiltros<T extends { distritoId?: number; iglesiaId?: number }>(
  req: Request,
  filtros: T,
): Promise<T> {
  const distrito = distritoDe(req);
  if (distrito === null) return filtros;

  if (filtros.distritoId !== undefined && filtros.distritoId !== distrito) {
    await denegar(req, `Filtro distritoId=${filtros.distritoId}; distrito del usuario: ${distrito}`);
  }
  if (filtros.iglesiaId !== undefined) {
    const distritoIglesia = await distritoDeIglesia(filtros.iglesiaId);
    // Una iglesia inexistente no es fuera de alcance: el filtro simplemente no devolverá nada.
    if (distritoIglesia !== undefined && distritoIglesia !== distrito) {
      await denegar(req, `Filtro iglesiaId=${filtros.iglesiaId} (distrito ${distritoIglesia}); distrito del usuario: ${distrito}`);
    }
  }

  return { ...filtros, distritoId: distrito };
}
