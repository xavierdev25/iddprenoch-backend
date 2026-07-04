import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { comunicadosController } from './comunicados.controller';

export const comunicadosRouter = Router();

comunicadosRouter.get('/', revalidateCache, comunicadosController.list);
comunicadosRouter.get('/:id', revalidateCache, comunicadosController.detail);
comunicadosRouter.post('/', requireAuth, comunicadosController.create);
comunicadosRouter.put('/:id', requireAuth, comunicadosController.update);
comunicadosRouter.delete('/:id', requireAuth, comunicadosController.remove);
