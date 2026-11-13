import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { congregantesController } from './congregantes.controller';

export const congregantesRouter = Router();

// Datos personales sensibles: toda la entidad requiere sesión y el permiso de membresía, incluido
// el GET; el obispo distrital queda acotado a su distrito (ver el controlador).
congregantesRouter.use(requireAuthYPermiso('membresia'));

congregantesRouter.get('/', congregantesController.list);
congregantesRouter.get('/:id', congregantesController.detail);
congregantesRouter.post('/', congregantesController.create);
congregantesRouter.put('/:id', congregantesController.update);
congregantesRouter.delete('/:id', congregantesController.remove);
