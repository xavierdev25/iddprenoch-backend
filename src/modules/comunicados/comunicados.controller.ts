import { buildCrudController } from '../../utils/crudFactory';
import { comunicadosService } from './comunicados.service';
import { createComunicadoSchema, updateComunicadoSchema } from './comunicados.schema';

export const comunicadosController = buildCrudController(comunicadosService, {
  createSchema: createComunicadoSchema,
  updateSchema: updateComunicadoSchema,
});
