import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { ministeriosController, getBySlug, getLideresPublico } from './ministerios.controller';

export const ministeriosRouter = Router();

ministeriosRouter.get('/', revalidateCache, ministeriosController.list);
ministeriosRouter.get('/slug/:slug', revalidateCache, getBySlug);
ministeriosRouter.get('/:slug/lideres-publico', revalidateCache, getLideresPublico);
ministeriosRouter.get('/:id', revalidateCache, ministeriosController.detail);
ministeriosRouter.post('/', requireAuth, ministeriosController.create);
ministeriosRouter.put('/:id', requireAuth, ministeriosController.update);
ministeriosRouter.delete('/:id', requireAuth, ministeriosController.remove);
