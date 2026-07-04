import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const eventosService = buildCrudService({
  entityName: 'Evento',
  model: prisma.evento,
  orderBy: { fechaConHora: 'asc' },
  toResponse: (e) => ({
    id: e.id,
    nombre: e.nombre,
    fechaConHora: e.fechaConHora.toISOString(),
    ubicacion: e.ubicacion ?? undefined,
    descripcion: e.descripcion ?? undefined,
    imagen: e.imagen ?? undefined,
  }),
});
