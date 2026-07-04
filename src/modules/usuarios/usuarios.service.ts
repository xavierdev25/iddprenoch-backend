import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';
import { ApiError } from '../../utils/ApiError';

const BCRYPT_COST_FACTOR = 12;

interface UsuarioRecord {
  id: number;
  nombre: string;
  email: string | null;
  rolId: number;
  estadoId: number;
}

function toResponse(u: UsuarioRecord) {
  return { id: u.id, nombre: u.nombre, email: u.email ?? undefined, rolId: u.rolId, estadoId: u.estadoId };
}

interface CreateUsuarioInput {
  nombre: string;
  email?: string;
  password: string;
  rolId: number;
  estadoId: number;
}

interface UpdateUsuarioInput {
  nombre?: string;
  email?: string;
  password?: string;
  rolId?: number;
  estadoId?: number;
}

// Reuses the generic factory for the read-only paths (identical to every other entity) and
// hand-rolls create/update because the password never travels through the DB as-is.
const baseService = buildCrudService({
  entityName: 'Usuario',
  model: prisma.usuario,
  orderBy: { nombre: 'asc' },
  toResponse,
});

export const usuariosService = {
  list: baseService.list,
  getById: baseService.getById,

  async create(input: CreateUsuarioInput) {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);
    const created = await prisma.usuario.create({
      data: { nombre: input.nombre, email: input.email, passwordHash, rolId: input.rolId, estadoId: input.estadoId },
    });
    return toResponse(created);
  },

  async update(id: number, input: UpdateUsuarioInput) {
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Usuario no encontrado');

    const { password, ...rest } = input;
    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    }

    const updated = await prisma.usuario.update({ where: { id }, data });
    return toResponse(updated);
  },

  remove: baseService.remove,
};
