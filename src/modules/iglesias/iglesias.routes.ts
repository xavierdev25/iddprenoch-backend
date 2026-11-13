import { Router } from 'express';
import { requireAuthYPermiso, vistaPanel } from '../../middlewares/auth.middleware';
import { revalidateCache } from '../../middlewares/cache.middleware';
import { iglesiasController } from './iglesias.controller';

export const iglesiasRouter = Router();

// El GET es público y sin filtrar (lo usa el sitio). Con `?ambito=panel` exige sesión y se acota al
// distrito del obispo distrital; la escritura siempre exige permiso y alcance (ADR-026).
const panel = vistaPanel('iglesias');
const soloConPermiso = requireAuthYPermiso('iglesias');

iglesiasRouter.get('/', revalidateCache, panel, iglesiasController.list);
iglesiasRouter.get('/:id', revalidateCache, panel, iglesiasController.detail);
iglesiasRouter.post('/', soloConPermiso, iglesiasController.create);
iglesiasRouter.put('/:id', soloConPermiso, iglesiasController.update);
iglesiasRouter.delete('/:id', soloConPermiso, iglesiasController.remove);
