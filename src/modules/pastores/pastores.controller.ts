import { buildCrudController } from '../../utils/crudFactory';
import { pastoresService } from './pastores.service';
import { createPastorSchema, updatePastorSchema } from './pastores.schema';

export const pastoresController = buildCrudController(pastoresService, {
  createSchema: createPastorSchema,
  updateSchema: updatePastorSchema,
});
