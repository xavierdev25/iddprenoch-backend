import { Router } from 'express';
import { requireAuthYPermiso } from '../../middlewares/auth.middleware';
import { asambleasController as c } from './asambleas.controller';

/**
 * Panel de asambleas (permiso "asambleas", ADR-026). Todo exige sesión, permiso y alcance: el
 * obispo distrital solo opera las asambleas distritales de su distrito.
 */
const conPermiso = requireAuthYPermiso('asambleas');

export const asambleasRouter = Router();
asambleasRouter.use(conPermiso);
asambleasRouter.get('/', c.listar);
asambleasRouter.post('/', c.crear);
asambleasRouter.get('/:id', c.detalle);
asambleasRouter.put('/:id', c.actualizar);
asambleasRouter.delete('/:id', c.eliminar);
asambleasRouter.post('/:id/elecciones', c.crearEleccion);
asambleasRouter.get('/:id/electores', c.listarElectores);
asambleasRouter.post('/:id/electores', c.agregarElector);
asambleasRouter.post('/:id/electores/importar', c.importarPadron);
asambleasRouter.get('/:id/electores/dni/:dni', c.buscarDni);
asambleasRouter.delete('/:id/electores/:electorId', c.eliminarElector);
asambleasRouter.post('/:id/acreditar', c.acreditar);

export const eleccionesRouter = Router();
eleccionesRouter.use(conPermiso);
eleccionesRouter.put('/:id', c.actualizarEleccion);
eleccionesRouter.delete('/:id', c.eliminarEleccion);
eleccionesRouter.post('/:id/candidatos', c.crearCandidato);

export const candidatosRouter = Router();
// La foto es lo único público del módulo (ver el controlador); va antes del control de sesión.
candidatosRouter.get('/:id/foto', c.fotoCandidato);
candidatosRouter.use(conPermiso);
candidatosRouter.put('/:id', c.actualizarCandidato);
candidatosRouter.delete('/:id', c.eliminarCandidato);
