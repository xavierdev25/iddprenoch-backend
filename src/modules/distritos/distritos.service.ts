import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const distritosService = buildCrudService({
  entityName: 'Distrito',
  model: prisma.distrito,
  orderBy: { nombre: 'asc' },
});
