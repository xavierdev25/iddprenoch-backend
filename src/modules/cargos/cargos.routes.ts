import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { cargosController } from './cargos.controller';

export const cargosRouter = Router();

// Lectura pública; la escritura exige el permiso "organizacion" (ADR-026).
const soloConPermiso = requireAuthYPermiso('organizacion');

cargosRouter.get('/', cargosController.list);
cargosRouter.get('/:id', cargosController.detail);
cargosRouter.post('/', soloConPermiso, cargosController.create);
cargosRouter.put('/:id', soloConPermiso, cargosController.update);
cargosRouter.delete('/:id', soloConPermiso, cargosController.remove);
