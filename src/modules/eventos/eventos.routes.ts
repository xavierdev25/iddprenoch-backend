import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { eventosController } from './eventos.controller';

export const eventosRouter = Router();

eventosRouter.get('/', revalidateCache, eventosController.list);
eventosRouter.get('/:id', revalidateCache, eventosController.detail);
eventosRouter.post('/', requireAuth, eventosController.create);
eventosRouter.put('/:id', requireAuth, eventosController.update);
eventosRouter.delete('/:id', requireAuth, eventosController.remove);
