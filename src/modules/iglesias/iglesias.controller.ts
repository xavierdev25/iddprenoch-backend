import { buildCrudController } from '../../utils/crudFactory';
import { iglesiasService } from './iglesias.service';
import { createIglesiaSchema, updateIglesiaSchema } from './iglesias.schema';

export const iglesiasController = buildCrudController(iglesiasService, {
  createSchema: createIglesiaSchema,
  updateSchema: updateIglesiaSchema,
});
