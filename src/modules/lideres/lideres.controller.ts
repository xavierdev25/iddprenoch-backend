import { buildCrudController } from '../../utils/crudFactory';
import { lideresService } from './lideres.service';
import { createLiderSchema, updateLiderSchema } from './lideres.schema';

export const lideresController = buildCrudController(lideresService, {
  createSchema: createLiderSchema,
  updateSchema: updateLiderSchema,
});
