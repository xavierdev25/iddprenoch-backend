import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { iglesiasController } from './iglesias.controller';

export const iglesiasRouter = Router();

iglesiasRouter.get('/', revalidateCache, iglesiasController.list);
iglesiasRouter.get('/:id', revalidateCache, iglesiasController.detail);
iglesiasRouter.post('/', requireAuth, iglesiasController.create);
iglesiasRouter.put('/:id', requireAuth, iglesiasController.update);
iglesiasRouter.delete('/:id', requireAuth, iglesiasController.remove);
