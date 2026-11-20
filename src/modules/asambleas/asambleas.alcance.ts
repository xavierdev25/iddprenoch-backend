import { Request } from 'express';
import { ApiError } from '../../utils/ApiError';
import { auditar } from '../../utils/auditoria';
import { distritoDe } from '../../utils/alcance';

/**
 * Alcance de las asambleas (matriz de ADR-026): el obispo distrital gestiona solo las asambleas
 * DISTRITALES de su distrito; las REGIONALES las gestionan el Responsable y el Obispo regional.
 */

export interface AsambleaConAlcance {
  tipo: 'REGIONAL' | 'DISTRITAL';
  distritoId: number | null;
}

export function whereAsambleasEnAlcance(req: Request): Record<string, unknown> {
  const distrito = distritoDe(req);
  return distrito === null ? {} : { tipo: 'DISTRITAL', distritoId: distrito };
}

export function asambleaEnAlcance(distritoUsuario: number | null, asamblea: AsambleaConAlcance): boolean {
  if (distritoUsuario === null) return true;
  return asamblea.tipo === 'DISTRITAL' && asamblea.distritoId === distritoUsuario;
}

/** 403 auditado si la asamblea está fuera del alcance del usuario. */
export async function exigirAsambleaEnAlcance(req: Request, asamblea: AsambleaConAlcance): Promise<void> {
  if (asambleaEnAlcance(distritoDe(req), asamblea)) return;
  await auditar(
    req,
    `${req.method} fuera de alcance`,
    'DENEGADO',
    `Asamblea ${asamblea.tipo}${asamblea.distritoId ? ` del distrito ${asamblea.distritoId}` : ''}`,
  );
  throw new ApiError(403, 'Esa asamblea está fuera de tu alcance');
}
