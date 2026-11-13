import { Request } from 'express';
import { prisma } from '../db/prisma';
import { logger } from './logger';

export type ResultadoAuditoria = 'PERMITIDO' | 'DENEGADO';

export interface EventoAuditoria {
  usuarioId?: number | null;
  usuarioNombre?: string | null;
  accion: string;
  recurso: string;
  resultado: ResultadoAuditoria;
  detalle?: string;
  ip?: string | null;
}

/** Meses que se conserva un registro de auditoría (Ley 29733, ver ADR-027). */
export const MESES_RETENCION_AUDITORIA = 12;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Guarda un evento. Nunca lanza: si la auditoría falla, la operación del usuario ya ocurrió (o ya
 * se le negó) y responderle 500 por eso sería peor que perder la fila, que queda en el log.
 */
export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId: evento.usuarioId ?? null,
        usuarioNombre: evento.usuarioNombre?.slice(0, 255) ?? null,
        accion: evento.accion,
        recurso: evento.recurso.slice(0, 255),
        resultado: evento.resultado,
        detalle: evento.detalle,
        ip: evento.ip?.slice(0, 45) ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, evento }, 'No se pudo registrar el evento de auditoría');
  }
}

/**
 * Ruta de la request sin query string: el query puede traer una búsqueda por DNI o nombre (`?q=`),
 * y copiarla a la auditoría duplicaría datos personales en una tabla que se conserva un año.
 */
export function recursoDe(req: Request): string {
  return req.originalUrl.split('?')[0];
}

/** Atajo para auditar una request autenticada: toma usuario, ruta e IP de la propia request. */
export function auditar(req: Request, accion: string, resultado: ResultadoAuditoria, detalle?: string): Promise<void> {
  return registrarAuditoria({
    usuarioId: req.user?.id,
    usuarioNombre: req.user?.nombre,
    accion,
    recurso: recursoDe(req),
    resultado,
    detalle,
    ip: req.ip,
  });
}

/** Fecha antes de la cual un registro ya cumplió su plazo de retención. */
export function fechaCorteRetencion(ahora: Date): Date {
  const corte = new Date(ahora);
  corte.setMonth(corte.getMonth() - MESES_RETENCION_AUDITORIA);
  return corte;
}

export async function limpiarAuditoriaAntigua(ahora = new Date()): Promise<number> {
  const { count } = await prisma.auditoria.deleteMany({ where: { fecha: { lt: fechaCorteRetencion(ahora) } } });
  return count;
}

/**
 * Limpieza diaria dentro del propio proceso: el hosting no ofrece cron sin SSH. Corre también al
 * arrancar, porque Passenger apaga el proceso cuando no hay tráfico y un intervalo de 24 h podría
 * no llegar a cumplirse nunca; con las dos cosas, se limpia al menos una vez por día con uso.
 */
export function iniciarLimpiezaAuditoria(): void {
  const limpiar = () => {
    limpiarAuditoriaAntigua()
      .then((borrados) => {
        if (borrados > 0) logger.info({ borrados }, 'Auditoría: registros vencidos eliminados');
      })
      .catch((err) => logger.error({ err }, 'Auditoría: falló la limpieza de registros vencidos'));
  };
  limpiar();
  // unref: el intervalo no debe impedir que el proceso termine (SIGTERM de Passenger, tests).
  setInterval(limpiar, UN_DIA_MS).unref();
}
