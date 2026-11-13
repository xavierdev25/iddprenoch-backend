import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { lideresController } from './lideres.controller';

export const lideresRouter = Router();

// Datos personales sensibles: toda la entidad requiere autenticación, incluyendo GET.
lideresRouter.use(requireAuthYPermiso('iglesias'));

lideresRouter.get('/', lideresController.list);
lideresRouter.get('/:id', lideresController.detail);
lideresRouter.post('/', lideresController.create);
lideresRouter.put('/:id', lideresController.update);
lideresRouter.delete('/:id', lideresController.remove);
