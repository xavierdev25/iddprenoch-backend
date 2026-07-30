import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';
import { calcularEdad, clasificarGrupoEtario } from '../../utils/edad';

function toDateOnly(date: Date | null): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

export const congregantesService = buildCrudService({
  entityName: 'Congregante',
  model: prisma.congregante,
  orderBy: { apellido: 'asc' },
  toResponse: (c) => {
    // `edad` y `grupoEtario` se calculan aquí y no se guardan: derivados de fechaNacimiento, se
    // mantienen correctos solos con el paso del tiempo. El frontend los recibe listos para mostrar.
    const edad = calcularEdad(c.fechaNacimiento);
    return {
      id: c.id,
      dni: c.dni,
      nombre: c.nombre,
      apellido: c.apellido,
      telefono: c.telefono ?? undefined,
      correo: c.correo ?? undefined,
      fechaNacimiento: toDateOnly(c.fechaNacimiento),
      edad,
      grupoEtario: clasificarGrupoEtario(edad),
      iglesiaId: c.iglesiaId,
      ministerioId: c.ministerioId ?? undefined,
      sexoId: c.sexoId,
      estadoCivilId: c.estadoCivilId,
      estadoEclesialId: c.estadoEclesialId,
      fechaConversion: toDateOnly(c.fechaConversion),
      fechaBautismo: toDateOnly(c.fechaBautismo),
    };
  },
});
