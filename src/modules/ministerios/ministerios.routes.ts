import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { ministeriosController, getBySlug, getLideresPublico } from './ministerios.controller';

export const ministeriosRouter = Router();

// Lectura pública; la escritura exige el permiso "organizacion" (ADR-026).
const soloConPermiso = requireAuthYPermiso('organizacion');

ministeriosRouter.get('/', revalidateCache, ministeriosController.list);
ministeriosRouter.get('/slug/:slug', revalidateCache, getBySlug);
ministeriosRouter.get('/:slug/lideres-publico', revalidateCache, getLideresPublico);
ministeriosRouter.get('/:id', revalidateCache, ministeriosController.detail);
ministeriosRouter.post('/', soloConPermiso, ministeriosController.create);
ministeriosRouter.put('/:id', soloConPermiso, ministeriosController.update);
ministeriosRouter.delete('/:id', soloConPermiso, ministeriosController.remove);
