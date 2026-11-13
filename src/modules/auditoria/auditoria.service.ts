import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const auditoriaService = buildCrudService({
  entityName: 'Registro de auditoría',
  model: prisma.auditoria,
  orderBy: { fecha: 'desc' },
  toResponse: (a) => ({
    id: a.id,
    fecha: a.fecha,
    usuarioId: a.usuarioId ?? undefined,
    usuarioNombre: a.usuarioNombre ?? undefined,
    accion: a.accion,
    recurso: a.recurso,
    resultado: a.resultado,
    detalle: a.detalle ?? undefined,
    ip: a.ip ?? undefined,
  }),
});
