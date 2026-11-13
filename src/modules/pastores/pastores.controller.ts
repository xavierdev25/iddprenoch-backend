import { buildCrudController } from '../../utils/crudFactory';
import { pastoresService } from './pastores.service';
import { createPastorSchema, updatePastorSchema } from './pastores.schema';

export const pastoresController = buildCrudController(pastoresService, {
  createSchema: createPastorSchema,
  updateSchema: updatePastorSchema,
  alcance: 'iglesia',
  // El celular es un dato personal del pastor: solo lo ve el panel, nunca el sitio público.
  respuestaPublica: ({ celular: _celular, ...publico }) => publico,
});
