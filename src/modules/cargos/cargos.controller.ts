import { buildCrudController } from '../../utils/crudFactory';
import { cargosService } from './cargos.service';
import { createCargoSchema, updateCargoSchema } from './cargos.schema';

export const cargosController = buildCrudController(cargosService, {
  createSchema: createCargoSchema,
  updateSchema: updateCargoSchema,
});
