import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { distritosController } from './distritos.controller';

export const distritosRouter = Router();

// Lectura pública; la escritura exige el permiso "organizacion" (ADR-026).
const soloConPermiso = requireAuthYPermiso('organizacion');

distritosRouter.get('/', revalidateCache, distritosController.list);
distritosRouter.get('/:id', revalidateCache, distritosController.detail);
distritosRouter.post('/', soloConPermiso, distritosController.create);
distritosRouter.put('/:id', soloConPermiso, distritosController.update);
distritosRouter.delete('/:id', soloConPermiso, distritosController.remove);
