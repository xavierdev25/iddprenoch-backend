import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { formatZodError } from '../../utils/crudFactory';
import { esCodigoAccesoValido } from '../../utils/codigos';
import { etagElector, vistaElector } from './votacion.estado';
import { abrirSesionElector, cerrarSesionElector } from './votacion.sesion';
import * as service from './votacion.service';

const ingresoSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI tiene 8 dígitos.'),
  codigo: z.string().regex(/^\d{4}$/, 'El código tiene 4 dígitos.'),
});

const votoSchema = z.object({
  eleccionId: z.number().int().positive(),
  candidatoId: z.number().int().positive(),
});

function codigoDeRuta(req: Request): string {
  const codigo = String(req.params.codigo ?? '').toUpperCase();
  if (!esCodigoAccesoValido(codigo)) throw new ApiError(404, 'No encontramos esa asamblea. Revisa el código del QR.');
  return codigo;
}

/** La asamblea de la URL, y que la sesión del elector sea de esa misma asamblea. */
async function asambleaDeLaSesion(req: Request) {
  const e = await service.asambleaPorCodigo(codigoDeRuta(req));
  if (req.elector!.asambleaId !== e.asambleaId) {
    throw new ApiError(401, 'Tu sesión es de otra asamblea. Vuelve a ingresar con el código de esta.');
  }
  return e;
}

export const votacionController = {
  info: asyncHandler(async (req: Request, res: Response) => {
    const e = await service.asambleaPorCodigo(codigoDeRuta(req));
    res.set('Cache-Control', 'no-cache').json(service.info(e));
  }),

  ingresar: asyncHandler(async (req: Request, res: Response) => {
    const e = await service.asambleaPorCodigo(codigoDeRuta(req));
    const datos = ingresoSchema.safeParse(req.body);
    if (!datos.success) throw new ApiError(400, formatZodError(datos.error).replace(/^\w+: /, ''));
    const { sesion, elector } = await service.ingresar(e, datos.data.dni, datos.data.codigo, req.ip);
    abrirSesionElector(res, sesion);
    res.json({ elector, asamblea: service.info(e) });
  }),

  salir: asyncHandler(async (_req: Request, res: Response) => {
    cerrarSesionElector(res);
    res.json({ ok: true });
  }),

  /**
   * El polling del elector (ADR-028): cada 3 s ± 1 s, desde memoria, sin tocar la base. Con ETag:
   * si nada cambió responde 304 sin cuerpo.
   */
  estado: asyncHandler(async (req: Request, res: Response) => {
    const e = await asambleaDeLaSesion(req);
    const electorId = req.elector!.electorId;
    const etag = etagElector(e, electorId);
    res.set({ 'Cache-Control': 'private, no-cache', ETag: etag });
    if (req.get('if-none-match') === etag) {
      res.status(304).end();
      return;
    }
    res.json(vistaElector(e, electorId));
  }),

  cedula: asyncHandler(async (req: Request, res: Response) => {
    const e = await asambleaDeLaSesion(req);
    res.set('Cache-Control', 'no-store').json(await service.cedula(e, req.elector!.electorId));
  }),

  votar: asyncHandler(async (req: Request, res: Response) => {
    const e = await asambleaDeLaSesion(req);
    const datos = votoSchema.safeParse(req.body);
    if (!datos.success) throw new ApiError(400, 'Voto inválido.');
    const resultado = await service.votar(e, req.elector!, datos.data.eleccionId, datos.data.candidatoId);
    res.status(201).set('Cache-Control', 'no-store').json(resultado);
  }),
};
