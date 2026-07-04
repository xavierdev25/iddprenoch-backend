import { Request, Response } from 'express';
import { asyncHandler } from './asyncHandler';

interface CatalogDelegate {
  findMany: (args?: any) => Promise<{ id: number; nombre: string }[]>;
}

export function buildCatalogHandler(model: CatalogDelegate) {
  return asyncHandler(async (_req: Request, res: Response) => {
    res.json(await model.findMany({ orderBy: { nombre: 'asc' } }));
  });
}
