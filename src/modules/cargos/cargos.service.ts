import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const cargosService = buildCrudService({
  entityName: 'Cargo',
  model: prisma.cargo,
  orderBy: { id: 'asc' },
});
