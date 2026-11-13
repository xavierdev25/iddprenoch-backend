import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { comunicadosController } from './comunicados.controller';

export const comunicadosRouter = Router();

// Lectura pública; la escritura exige el permiso "contenido" (ADR-026).
const soloConPermiso = requireAuthYPermiso('contenido');

comunicadosRouter.get('/', revalidateCache, comunicadosController.list);
comunicadosRouter.get('/:id', revalidateCache, comunicadosController.detail);
comunicadosRouter.post('/', soloConPermiso, comunicadosController.create);
comunicadosRouter.put('/:id', soloConPermiso, comunicadosController.update);
comunicadosRouter.delete('/:id', soloConPermiso, comunicadosController.remove);
