import { buildCrudController } from '../../utils/crudFactory';
import { distritosService } from './distritos.service';
import { createDistritoSchema, updateDistritoSchema } from './distritos.schema';

export const distritosController = buildCrudController(distritosService, {
  createSchema: createDistritoSchema,
  updateSchema: updateDistritoSchema,
});
