import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const iglesiasService = buildCrudService({
  entityName: 'Iglesia',
  model: prisma.iglesia,
  orderBy: { nombre: 'asc' },
  toResponse: (i) => ({
    id: i.id,
    nombre: i.nombre,
    direccion: i.direccion,
    distritoId: i.distritoId,
    ministerioId: i.ministerioId ?? undefined,
    foto: i.foto ?? undefined,
  }),
});
