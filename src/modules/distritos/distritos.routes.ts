import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { distritosController } from './distritos.controller';

export const distritosRouter = Router();

distritosRouter.get('/', revalidateCache, distritosController.list);
distritosRouter.get('/:id', revalidateCache, distritosController.detail);
distritosRouter.post('/', requireAuth, distritosController.create);
distritosRouter.put('/:id', requireAuth, distritosController.update);
distritosRouter.delete('/:id', requireAuth, distritosController.remove);
