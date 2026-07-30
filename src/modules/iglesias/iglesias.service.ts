import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';
import { enlaceMapa } from '../../utils/mapsUrl';

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
    latitud: i.latitud ?? undefined,
    longitud: i.longitud ?? undefined,
    // Enlace derivado, no almacenado: se arma desde las coordenadas para que no pueda quedar
    // apuntando a un punto distinto del guardado.
    mapsUrl:
      i.latitud !== null && i.longitud !== null
        ? enlaceMapa({ latitud: i.latitud, longitud: i.longitud })
        : undefined,
  }),
});
