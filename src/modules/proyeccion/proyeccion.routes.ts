import { Request, Response, Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { esCodigoAccesoValido } from '../../utils/codigos';
import { estadoPorCodigo } from '../votacion/votacion.estado';
import { ultimaProclamacion } from '../asambleas/conduccion.service';

/**
 * Pantalla de proyección (HU14), pública: es lo que ve toda la asamblea en el proyector. Solo
 * conoce ganadores ya publicados por la mesa; nunca conteos ni elecciones en curso (ADR-028).
 */
export const proyeccionRouter = Router();

proyeccionRouter.get(
  '/:codigo',
  asyncHandler(async (req: Request, res: Response) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const estado = esCodigoAccesoValido(codigo) ? await estadoPorCodigo(codigo) : null;
    if (!estado) throw new ApiError(404, 'Asamblea no encontrada');
    res.set('Cache-Control', 'no-cache').json({
      asamblea: { nombre: estado.nombre, estado: estado.estadoAsamblea },
      proclamado: await ultimaProclamacion(estado.asambleaId),
    });
  }),
);
