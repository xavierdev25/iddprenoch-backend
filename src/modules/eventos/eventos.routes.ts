import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { eventosController } from './eventos.controller';

export const eventosRouter = Router();

// Lectura pública; la escritura exige el permiso "contenido" (ADR-026).
const soloConPermiso = requireAuthYPermiso('contenido');

eventosRouter.get('/', revalidateCache, eventosController.list);
eventosRouter.get('/:id', revalidateCache, eventosController.detail);
eventosRouter.post('/', soloConPermiso, eventosController.create);
eventosRouter.put('/:id', soloConPermiso, eventosController.update);
eventosRouter.delete('/:id', soloConPermiso, eventosController.remove);
