import { buildCrudController } from '../../utils/crudFactory';
import { usuariosService } from './usuarios.service';
import { createUsuarioSchema, updateUsuarioSchema } from './usuarios.schema';

export const usuariosController = buildCrudController(usuariosService, {
  createSchema: createUsuarioSchema,
  updateSchema: updateUsuarioSchema,
});
