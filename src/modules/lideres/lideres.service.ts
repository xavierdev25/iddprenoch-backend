import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

export const lideresService = buildCrudService({
  entityName: 'Lider',
  model: prisma.lider,
  orderBy: { apellido: 'asc' },
  toResponse: (l) => ({
    id: l.id,
    dni: l.dni,
    nombre: l.nombre,
    apellido: l.apellido,
    telefono: l.telefono ?? undefined,
    correo: l.correo ?? undefined,
    ministerioId: l.ministerioId,
    iglesiaId: l.iglesiaId,
  }),
});

// Para la página pública de ministerio. Usa `select` (no `include`/mapeo posterior) para que
// dni, telefono y correo nunca salgan de la base de datos, ni siquiera para descartarlos después.
export async function listPublicByMinisterio(ministerioId: number) {
  return prisma.lider.findMany({
    where: { ministerioId },
    select: { id: true, nombre: true, apellido: true, ministerioId: true },
    orderBy: { apellido: 'asc' },
  });
}
