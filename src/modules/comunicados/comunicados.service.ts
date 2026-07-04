import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const comunicadosService = buildCrudService({
  entityName: 'Comunicado',
  model: prisma.comunicado,
  orderBy: { createdAt: 'desc' },
  toResponse: (c) => ({
    id: c.id,
    titulo: c.titulo,
    imagen: c.imagen ?? undefined,
    descripcion: c.descripcion ?? undefined,
  }),
});
