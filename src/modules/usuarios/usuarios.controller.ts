import { Request, Response } from 'express';
import { ZodType } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { formatZodError, parseId, parsePagination } from '../../utils/crudFactory';
import { auditar } from '../../utils/auditoria';
import { usuariosService } from './usuarios.service';
import { createUsuarioSchema, updateUsuarioSchema } from './usuarios.schema';

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, formatZodError(result.error));
  return result.data;
}

// No usa buildCrudController: cada alta, edición y baja de una cuenta se audita con el detalle de
// qué rol o distrito cambió y a quién (quién lo hizo sale de la propia request).
export const usuariosController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req);
    res.json(await usuariosService.list(page, limit));
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    res.json(await usuariosService.getById(parseId(req)));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { usuario, detalle } = await usuariosService.create(parseBody(createUsuarioSchema, req.body));
    await auditar(req, 'CREAR USUARIO', 'PERMITIDO', detalle);
    res.status(201).json(usuario);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { usuario, detalle } = await usuariosService.update(
      parseId(req),
      parseBody(updateUsuarioSchema, req.body),
      req.user!,
    );
    await auditar(req, 'EDITAR USUARIO', 'PERMITIDO', detalle);
    res.json(usuario);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { detalle } = await usuariosService.remove(parseId(req), req.user!);
    await auditar(req, 'ELIMINAR USUARIO', 'PERMITIDO', detalle);
    res.status(204).send();
  }),
};
