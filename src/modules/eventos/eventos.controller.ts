import { buildCrudController } from '../../utils/crudFactory';
import { eventosService } from './eventos.service';
import { createEventoSchema, updateEventoSchema } from './eventos.schema';

export const eventosController = buildCrudController(eventosService, {
  createSchema: createEventoSchema,
  updateSchema: updateEventoSchema,
});
