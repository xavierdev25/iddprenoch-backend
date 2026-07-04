import { Request, Response } from 'express';
import { buildCrudController } from '../../utils/crudFactory';
import { asyncHandler } from '../../utils/asyncHandler';
import { ministeriosService, getMinisterioBySlug } from './ministerios.service';
import { createMinisterioSchema, updateMinisterioSchema } from './ministerios.schema';
import { listPublicByMinisterio } from '../lideres/lideres.service';

export const ministeriosController = buildCrudController(ministeriosService, {
  createSchema: createMinisterioSchema,
  updateSchema: updateMinisterioSchema,
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  res.json(await getMinisterioBySlug(req.params.slug));
});

export const getLideresPublico = asyncHandler(async (req: Request, res: Response) => {
  const ministerio = await getMinisterioBySlug(req.params.slug);
  res.json(await listPublicByMinisterio(ministerio.id));
});
