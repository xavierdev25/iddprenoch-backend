import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { reportesController } from './reportes.controller';

export const reportesRouter = Router();

// Los reportes exponen datos personales de congregantes (DNI, teléfono, correo, fecha de
// nacimiento), el mismo criterio que /api/congregantes: toda la entidad requiere sesión, incluidos
// los GET y las descargas.
reportesRouter.use(requireAuthYPermiso('membresia'));

// Consolidado: una fila por iglesia o distrito con los conteos por sexo, grupo etario y estado
// eclesial. `?agruparPor=distrito` cambia el nivel de agregación.
reportesRouter.get('/membresia', reportesController.membresia);
reportesRouter.get('/membresia.xlsx', reportesController.membresiaExcel);
reportesRouter.get('/membresia.pdf', reportesController.membresiaPdf);

// Nominal: una fila por miembro. `?iglesiaId=` da la lista de una iglesia concreta.
reportesRouter.get('/miembros', reportesController.miembros);
reportesRouter.get('/miembros.xlsx', reportesController.miembrosExcel);
reportesRouter.get('/miembros.pdf', reportesController.miembrosPdf);
