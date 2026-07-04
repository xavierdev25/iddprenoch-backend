import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { usuariosController } from './usuarios.controller';

export const usuariosRouter = Router();

// Gestión de cuentas de administración: toda la entidad requiere autenticación.
usuariosRouter.use(requireAuth);

usuariosRouter.get('/', usuariosController.list);
usuariosRouter.get('/:id', usuariosController.detail);
usuariosRouter.post('/', usuariosController.create);
usuariosRouter.put('/:id', usuariosController.update);
usuariosRouter.delete('/:id', usuariosController.remove);
