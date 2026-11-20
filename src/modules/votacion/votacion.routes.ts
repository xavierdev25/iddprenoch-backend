import { Router } from 'express';
import { votacionController as c } from './votacion.controller';
import { limitarEstado, limitarVoto } from './votacion.limites';
import { requireElector } from './votacion.sesion';

/**
 * API del elector (ADR-029), bajo /api/votacion/:codigo. Sin sesión de administrador: el elector
 * ingresa con DNI + código y recibe su propia cookie, válida solo para estas rutas.
 */
export const votacionRouter = Router({ mergeParams: true });

votacionRouter.get('/:codigo', c.info);
votacionRouter.post('/:codigo/ingresar', c.ingresar);
votacionRouter.post('/:codigo/salir', c.salir);
votacionRouter.get('/:codigo/estado', requireElector, limitarEstado, c.estado);
votacionRouter.get('/:codigo/cedula', requireElector, limitarEstado, c.cedula);
votacionRouter.post('/:codigo/votar', requireElector, limitarVoto, c.votar);
