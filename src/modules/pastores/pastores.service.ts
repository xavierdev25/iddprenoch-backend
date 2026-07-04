import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

// distritoId is not stored on Pastor — it's derived from the related Iglesia so the two
// can never drift apart. The `iglesia` include exists only to compute it for the response,
// which matches the frontend Pastor interface (distritoId?: number).
export const pastoresService = buildCrudService({
  entityName: 'Pastor',
  model: prisma.pastor,
  include: { iglesia: true },
  orderBy: { nombrePastor: 'asc' },
  toResponse: (p) => ({
    id: p.id,
    iglesiaId: p.iglesiaId,
    nombrePastor: p.nombrePastor,
    celular: p.celular ?? undefined,
    cargoId: p.cargoId,
    distritoId: p.iglesia.distritoId,
    foto: p.foto ?? undefined,
  }),
});
