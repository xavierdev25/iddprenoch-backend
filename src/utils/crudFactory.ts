import { Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { ApiError } from './ApiError';
import { asyncHandler } from './asyncHandler';

// Minimal shape of a Prisma model delegate (findMany/findUnique/etc). Using `any` for the
// query-arg positions is intentional: each entity has a different Prisma payload shape, and
// this factory is generic glue code sitting at the Express <-> Prisma boundary.
export interface PrismaDelegate {
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any | null>;
  count: (args?: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
}

export interface CrudModelConfig {
  entityName: string;
  model: PrismaDelegate;
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown>;
  /** Maps a raw Prisma record to the exact shape the frontend interface expects. */
  toResponse?: (record: any) => unknown;
}

export function buildCrudService(config: CrudModelConfig) {
  const map = config.toResponse ?? ((record: unknown) => record);

  return {
    async list(page: number, limit: number) {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        config.model.findMany({ include: config.include, orderBy: config.orderBy, skip, take: limit }),
        config.model.count(),
      ]);
      return { data: items.map(map), total, page, limit };
    },

    async getById(id: number) {
      const item = await config.model.findUnique({ where: { id }, include: config.include });
      if (!item) throw new ApiError(404, `${config.entityName} no encontrado`);
      return map(item);
    },

    async create(data: unknown) {
      const created = await config.model.create({ data: data as object, include: config.include });
      return map(created);
    },

    async update(id: number, data: unknown) {
      const existing = await config.model.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, `${config.entityName} no encontrado`);
      const updated = await config.model.update({ where: { id }, data: data as object, include: config.include });
      return map(updated);
    },

    async remove(id: number) {
      const existing = await config.model.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, `${config.entityName} no encontrado`);
      await config.model.delete({ where: { id } });
    },
  };
}

export type CrudService = ReturnType<typeof buildCrudService>;

export interface CrudSchemas {
  createSchema: ZodType;
  updateSchema: ZodType;
}

function parsePagination(req: Request) {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
  return { page, limit };
}

function parseId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'id inválido');
  return id;
}

function formatZodError(error: ZodError) {
  const first = error.issues[0];
  const field = first?.path.map(String).join('.') || 'body';
  return `${field}: ${first?.message ?? 'valor inválido'}`;
}

export function buildCrudController(service: CrudService, schemas: CrudSchemas) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const { page, limit } = parsePagination(req);
      res.json(await service.list(page, limit));
    }),

    detail: asyncHandler(async (req: Request, res: Response) => {
      res.json(await service.getById(parseId(req)));
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const result = schemas.createSchema.safeParse(req.body);
      if (!result.success) throw new ApiError(400, formatZodError(result.error));
      res.status(201).json(await service.create(result.data));
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const id = parseId(req);
      const result = schemas.updateSchema.safeParse(req.body);
      if (!result.success) throw new ApiError(400, formatZodError(result.error));
      res.json(await service.update(id, result.data));
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      await service.remove(parseId(req));
      res.status(204).send();
    }),
  };
}
