import { Router } from 'express';
import { requireAuthYPermiso, vistaPanel } from '../../middlewares/auth.middleware';
import { pastoresController } from './pastores.controller';

export const pastoresRouter = Router();

// Mismo criterio que iglesias: GET público sin filtrar (sin el celular, ver el controlador); con
// `?ambito=panel`, sesión + alcance por distrito. La escritura siempre exige permiso y alcance.
const panel = vistaPanel('iglesias');
const soloConPermiso = requireAuthYPermiso('iglesias');

pastoresRouter.get('/', panel, pastoresController.list);
pastoresRouter.get('/:id', panel, pastoresController.detail);
pastoresRouter.post('/', soloConPermiso, pastoresController.create);
pastoresRouter.put('/:id', soloConPermiso, pastoresController.update);
pastoresRouter.delete('/:id', soloConPermiso, pastoresController.remove);
