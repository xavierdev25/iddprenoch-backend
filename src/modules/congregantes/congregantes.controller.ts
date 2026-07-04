import { buildCrudController } from '../../utils/crudFactory';
import { congregantesService } from './congregantes.service';
import { createCongreganteSchema, updateCongreganteSchema } from './congregantes.schema';

export const congregantesController = buildCrudController(congregantesService, {
  createSchema: createCongreganteSchema,
  updateSchema: updateCongreganteSchema,
});
