import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { usuariosController } from './usuarios.controller';

export const usuariosRouter = Router();

// Gestión de cuentas, roles y distritos: solo el Responsable del sistema (ADR-026).
usuariosRouter.use(requireAuthYPermiso('usuarios'));

usuariosRouter.get('/', usuariosController.list);
usuariosRouter.get('/:id', usuariosController.detail);
usuariosRouter.post('/', usuariosController.create);
usuariosRouter.put('/:id', usuariosController.update);
usuariosRouter.delete('/:id', usuariosController.remove);
