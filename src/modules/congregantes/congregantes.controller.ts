import { buildCrudController } from '../../utils/crudFactory';
import { congregantesService } from './congregantes.service';
import { createCongreganteSchema, updateCongreganteSchema } from './congregantes.schema';
import { construirWhereCongregantes, parseFiltrosCongregantes } from './congregantes.filters';

export const congregantesController = buildCrudController(congregantesService, {
  createSchema: createCongreganteSchema,
  updateSchema: updateCongreganteSchema,
  // Mismos filtros que consume el módulo de reportes, para que la lista en pantalla y el Excel/PDF
  // descargado con los mismos parámetros devuelvan exactamente el mismo conjunto.
  parseListFilters: (query) => construirWhereCongregantes(parseFiltrosCongregantes(query)),
});
