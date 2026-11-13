import { Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { ApiError } from './ApiError';
import { asyncHandler } from './asyncHandler';
import { auditar } from './auditoria';
import {
  distritoDeIglesia,
  exigirDistritoEnAlcance,
  whereIglesiaEnAlcance,
  whereRelacionIglesiaEnAlcance,
} from './alcance';

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
    /**
     * `where` acota el listado (p. ej. congregantes de una iglesia). `total` se cuenta con el mismo
     * filtro que la página, si no la paginación del frontend mostraría el total sin filtrar.
     */
    async list(page: number, limit: number, where?: Record<string, unknown>) {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        config.model.findMany({ where, include: config.include, orderBy: config.orderBy, skip, take: limit }),
        config.model.count({ where }),
      ]);
      return { data: items.map(map), total, page, limit };
    },

    /** Registro crudo, sin `include` ni mapeo: lo usa el control de alcance para leer su distrito. */
    async findRecord(id: number): Promise<any | null> {
      return config.model.findUnique({ where: { id } });
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
  /**
   * Traduce los query params del listado a un `where` de Prisma. Opcional: los módulos sin
   * filtros (catálogos, comunicados) siguen listando todo. Recibe la request para poder aplicar
   * el alcance del usuario a los propios filtros (ver utils/alcance.ts).
   */
  parseListFilters?: (
    query: Request['query'],
    req: Request,
  ) => Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>;
  /**
   * Alcance por distrito del obispo distrital (ADR-026): cómo se llega al distrito de un registro.
   * `'iglesia'` = por su `iglesiaId` (congregantes, pastores, líderes); `'distrito'` = por su
   * propio `distritoId` (iglesias). Sin esta opción el módulo no se acota por distrito.
   */
  alcance?: 'iglesia' | 'distrito';
  /** Deja en la auditoría cada alta, edición y baja (p. ej. los cambios de membresía). */
  auditar?: boolean;
  /**
   * Recorta la respuesta de una request anónima (sitio público). Para los GET que comparten el
   * sitio y el panel: el panel recibe el registro completo, el público solo lo publicable.
   */
  respuestaPublica?: (item: any) => unknown;
}

export function parsePagination(req: Request) {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
  return { page, limit };
}

export function parseId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'id inválido');
  return id;
}

export function formatZodError(error: ZodError) {
  const first = error.issues[0];
  const field = first?.path.map(String).join('.') || 'body';
  return `${field}: ${first?.message ?? 'valor inválido'}`;
}

/** Une dos `where` sin que uno pise las claves del otro (ambos pueden filtrar por `iglesia`). */
function combinarWhere(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const tieneA = a !== undefined && Object.keys(a).length > 0;
  const tieneB = Object.keys(b).length > 0;
  if (tieneA && tieneB) return { AND: [a, b] };
  return tieneB ? b : a;
}

export function buildCrudController(service: CrudService, schemas: CrudSchemas) {
  const modoAlcance = schemas.alcance;
  const publico = (req: Request, item: unknown) =>
    !req.user && schemas.respuestaPublica ? schemas.respuestaPublica(item) : item;

  /** Distrito del payload validado; `null` = el payload no toca la iglesia/distrito (PUT parcial). */
  async function distritoDelPayload(data: Record<string, unknown>): Promise<number | null | undefined> {
    const campo = modoAlcance === 'iglesia' ? 'iglesiaId' : 'distritoId';
    const valor = data[campo];
    if (typeof valor !== 'number') return null;
    return modoAlcance === 'iglesia' ? distritoDeIglesia(valor) : valor;
  }

  /** Distrito de un registro existente; `null` si no existe (que responda el 404 del servicio). */
  async function distritoDelRegistro(id: number): Promise<number | null | undefined> {
    const registro = await service.findRecord(id);
    if (!registro) return null;
    return modoAlcance === 'iglesia' ? distritoDeIglesia(registro.iglesiaId) : registro.distritoId;
  }

  async function exigirRegistroEnAlcance(req: Request, id: number) {
    if (!modoAlcance || !req.user) return;
    const distrito = await distritoDelRegistro(id);
    if (distrito !== null) await exigirDistritoEnAlcance(req, distrito);
  }

  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const { page, limit } = parsePagination(req);
      const filtros = await schemas.parseListFilters?.(req.query, req);
      const alcance =
        modoAlcance === 'iglesia'
          ? whereRelacionIglesiaEnAlcance(req)
          : modoAlcance === 'distrito'
            ? whereIglesiaEnAlcance(req)
            : {};
      const pagina = await service.list(page, limit, combinarWhere(filtros, alcance));
      res.json({ ...pagina, data: pagina.data.map((item) => publico(req, item)) });
    }),

    detail: asyncHandler(async (req: Request, res: Response) => {
      const id = parseId(req);
      await exigirRegistroEnAlcance(req, id);
      res.json(publico(req, await service.getById(id)));
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const result = schemas.createSchema.safeParse(req.body);
      if (!result.success) throw new ApiError(400, formatZodError(result.error));
      const data = result.data as Record<string, unknown>;
      if (modoAlcance) {
        // En un alta el destino es obligatorio: si no se puede resolver, se deniega (ver alcance.ts).
        const destino = await distritoDelPayload(data);
        await exigirDistritoEnAlcance(req, destino ?? undefined);
      }
      const created = (await service.create(data)) as { id?: number };
      if (schemas.auditar) await auditar(req, 'CREAR', 'PERMITIDO', `id=${created.id}`);
      res.status(201).json(created);
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const id = parseId(req);
      const result = schemas.updateSchema.safeParse(req.body);
      if (!result.success) throw new ApiError(400, formatZodError(result.error));
      const data = result.data as Record<string, unknown>;
      if (modoAlcance) {
        // Dos condiciones: el registro debe ser hoy de su distrito, y no puede mudarlo a otro.
        await exigirRegistroEnAlcance(req, id);
        const destino = await distritoDelPayload(data);
        if (destino !== null) await exigirDistritoEnAlcance(req, destino);
      }
      const updated = await service.update(id, data);
      if (schemas.auditar) await auditar(req, 'EDITAR', 'PERMITIDO', `campos: ${Object.keys(data).join(', ') || 'ninguno'}`);
      res.json(updated);
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      const id = parseId(req);
      await exigirRegistroEnAlcance(req, id);
      await service.remove(id);
      if (schemas.auditar) await auditar(req, 'ELIMINAR', 'PERMITIDO');
      res.status(204).send();
    }),
  };
}
