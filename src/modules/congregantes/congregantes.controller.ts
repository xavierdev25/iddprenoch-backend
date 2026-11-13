import { buildCrudController } from '../../utils/crudFactory';
import { congregantesService } from './congregantes.service';
import { createCongreganteSchema, updateCongreganteSchema } from './congregantes.schema';
import { construirWhereCongregantes, parseFiltrosCongregantes } from './congregantes.filters';
import { aplicarAlcanceAFiltros } from '../../utils/alcance';

export const congregantesController = buildCrudController(congregantesService, {
  createSchema: createCongreganteSchema,
  updateSchema: updateCongreganteSchema,
  // Mismos filtros que consume el módulo de reportes, para que la lista en pantalla y el Excel/PDF
  // descargado con los mismos parámetros devuelvan exactamente el mismo conjunto.
  // El alcance se aplica sobre los filtros mismos, igual que en reportes, para que ambos sigan
  // devolviendo exactamente el mismo conjunto.
  parseListFilters: async (query, req) =>
    construirWhereCongregantes(await aplicarAlcanceAFiltros(req, parseFiltrosCongregantes(query))),
  alcance: 'iglesia',
  // Cambios de membresía: cada alta, edición y baja queda en la auditoría (HU05).
  auditar: true,
});
