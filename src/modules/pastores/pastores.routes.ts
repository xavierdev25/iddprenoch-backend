import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { pastoresController } from './pastores.controller';

export const pastoresRouter = Router();

pastoresRouter.get('/', pastoresController.list);
pastoresRouter.get('/:id', pastoresController.detail);
pastoresRouter.post('/', requireAuth, pastoresController.create);
pastoresRouter.put('/:id', requireAuth, pastoresController.update);
pastoresRouter.delete('/:id', requireAuth, pastoresController.remove);
