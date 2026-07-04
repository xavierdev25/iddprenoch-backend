import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { cargosController } from './cargos.controller';

export const cargosRouter = Router();

cargosRouter.get('/', cargosController.list);
cargosRouter.get('/:id', cargosController.detail);
cargosRouter.post('/', requireAuth, cargosController.create);
cargosRouter.put('/:id', requireAuth, cargosController.update);
cargosRouter.delete('/:id', requireAuth, cargosController.remove);
