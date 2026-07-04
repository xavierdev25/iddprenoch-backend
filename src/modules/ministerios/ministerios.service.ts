import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';
import { ApiError } from '../../utils/ApiError';

export const ministeriosService = buildCrudService({
  entityName: 'Ministerio',
  model: prisma.ministerio,
  orderBy: { nombre: 'asc' },
});

export async function getMinisterioBySlug(slug: string) {
  const ministerio = await prisma.ministerio.findUnique({ where: { slug } });
  if (!ministerio) throw new ApiError(404, 'Ministerio no encontrado');
  return ministerio;
}
