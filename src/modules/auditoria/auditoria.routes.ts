import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { auditoriaController } from './auditoria.controller';

export const auditoriaRouter = Router();

// Solo el Responsable del sistema consulta la auditoría (ADR-027). Solo lectura: los registros los
// escribe la propia API y los borra la limpieza de retención, nunca un usuario.
auditoriaRouter.use(requireAuthYPermiso('auditoria'));

auditoriaRouter.get('/', auditoriaController.list);
