import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';

function toDateOnly(date: Date | null): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

export const congregantesService = buildCrudService({
  entityName: 'Congregante',
  model: prisma.congregante,
  orderBy: { apellido: 'asc' },
  toResponse: (c) => ({
    id: c.id,
    dni: c.dni,
    nombre: c.nombre,
    apellido: c.apellido,
    telefono: c.telefono ?? undefined,
    correo: c.correo ?? undefined,
    iglesiaId: c.iglesiaId,
    sexoId: c.sexoId,
    estadoCivilId: c.estadoCivilId,
    estadoEclesialId: c.estadoEclesialId,
    fechaConversion: toDateOnly(c.fechaConversion),
    fechaBautismo: toDateOnly(c.fechaBautismo),
  }),
});
