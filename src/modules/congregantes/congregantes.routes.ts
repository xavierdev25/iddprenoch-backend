import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { congregantesController } from './congregantes.controller';

export const congregantesRouter = Router();

// Datos personales sensibles: toda la entidad requiere autenticación, incluyendo GET.
congregantesRouter.use(requireAuth);

congregantesRouter.get('/', congregantesController.list);
congregantesRouter.get('/:id', congregantesController.detail);
congregantesRouter.post('/', congregantesController.create);
congregantesRouter.put('/:id', congregantesController.update);
congregantesRouter.delete('/:id', congregantesController.remove);
