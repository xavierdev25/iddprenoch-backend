import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { buildCrudService } from '../../utils/crudFactory';
import { ApiError } from '../../utils/ApiError';
import { esRolDistrital } from '../../utils/permisos';
import { CreateUsuarioInput, UpdateUsuarioInput } from './usuarios.schema';

const BCRYPT_COST_FACTOR = 12;

interface UsuarioRecord {
  id: number;
  nombre: string;
  email: string | null;
  rolId: number;
  estadoId: number;
  distritoId: number | null;
}

function toResponse(u: UsuarioRecord) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email ?? undefined,
    rolId: u.rolId,
    estadoId: u.estadoId,
    distritoId: u.distritoId,
  };
}

/** Quien hace el cambio: se usa para impedir que un usuario se bloquee a sí mismo. */
interface Actor {
  id: number;
}

/**
 * Distrito que corresponde guardar según el rol (ADR-026): obligatorio para el obispo distrital y
 * siempre `null` para los demás. Se normaliza en vez de rechazar el sobrante para que cambiar a
 * alguien de obispo distrital a un rol regional no exija además borrar el distrito a mano.
 */
export function distritoSegunRol(rolNombre: string, distritoId: number | null | undefined): number | null {
  if (!esRolDistrital(rolNombre)) return null;
  if (!distritoId) throw new ApiError(400, 'distritoId: es obligatorio para el Obispo distrital');
  return distritoId;
}

async function nombreDeRol(rolId: number): Promise<string> {
  const rol = await prisma.rol.findUnique({ where: { id: rolId }, select: { nombre: true } });
  if (!rol) throw new ApiError(400, 'rolId: el rol no existe');
  return rol.nombre;
}

/** Rol, estado y distrito en texto, para que la auditoría diga "Editor → Obispo distrital" y no ids. */
async function etiquetas(u: Pick<UsuarioRecord, 'rolId' | 'estadoId' | 'distritoId'>) {
  const [rol, estado, distrito] = await Promise.all([
    prisma.rol.findUnique({ where: { id: u.rolId }, select: { nombre: true } }),
    prisma.estadoUsuario.findUnique({ where: { id: u.estadoId }, select: { nombre: true } }),
    u.distritoId ? prisma.distrito.findUnique({ where: { id: u.distritoId }, select: { nombre: true } }) : null,
  ]);
  return {
    rol: rol?.nombre ?? `#${u.rolId}`,
    estado: estado?.nombre ?? `#${u.estadoId}`,
    distrito: distrito?.nombre ?? 'ninguno',
  };
}

/** Describe qué cambió entre dos versiones de la cuenta. La contraseña nunca, solo que cambió. */
export function describirCambios(
  antes: { nombre: string; email: string | null; rol: string; estado: string; distrito: string },
  despues: { nombre: string; email: string | null; rol: string; estado: string; distrito: string },
  cambioPassword: boolean,
): string {
  const cambios: string[] = [];
  const campos = ['nombre', 'email', 'rol', 'estado', 'distrito'] as const;
  for (const campo of campos) {
    if (antes[campo] !== despues[campo]) cambios.push(`${campo}: ${antes[campo] ?? '—'} → ${despues[campo] ?? '—'}`);
  }
  if (cambioPassword) cambios.push('contraseña cambiada');
  return cambios.length ? cambios.join('; ') : 'sin cambios';
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
    const rol = await nombreDeRol(input.rolId);
    const distritoId = distritoSegunRol(rol, input.distritoId);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);
    const created = await prisma.usuario.create({
      data: {
        nombre: input.nombre,
        email: input.email,
        passwordHash,
        rolId: input.rolId,
        estadoId: input.estadoId,
        distritoId,
      },
    });
    const e = await etiquetas(created);
    return {
      usuario: toResponse(created),
      detalle: `Usuario "${created.nombre}" creado con rol ${e.rol}, distrito ${e.distrito}, estado ${e.estado}`,
    };
  },

  async update(id: number, input: UpdateUsuarioInput, actor: Actor) {
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Usuario no encontrado');

    // Sin esto, el único Responsable del sistema podría quitarse el rol o desactivarse y dejar la
    // plataforma sin nadie capaz de administrar usuarios.
    if (actor.id === id) {
      if (input.rolId !== undefined && input.rolId !== existing.rolId) {
        throw new ApiError(400, 'No puedes cambiar tu propio rol. Pide a otro Responsable del sistema que lo haga.');
      }
      if (input.estadoId !== undefined && input.estadoId !== existing.estadoId) {
        throw new ApiError(400, 'No puedes cambiar el estado de tu propia cuenta.');
      }
    }

    const rolId = input.rolId ?? existing.rolId;
    const distritoPedido = input.distritoId === undefined ? existing.distritoId : input.distritoId;
    const distritoId = distritoSegunRol(await nombreDeRol(rolId), distritoPedido);

    const { password, ...rest } = input;
    const data: Record<string, unknown> = { ...rest, distritoId };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    }

    const updated = await prisma.usuario.update({ where: { id }, data });
    const [antes, despues] = await Promise.all([etiquetas(existing), etiquetas(updated)]);
    return {
      usuario: toResponse(updated),
      detalle: `Usuario "${existing.nombre}": ${describirCambios(
        { nombre: existing.nombre, email: existing.email, ...antes },
        { nombre: updated.nombre, email: updated.email, ...despues },
        Boolean(password),
      )}`,
    };
  },

  async remove(id: number, actor: Actor) {
    if (actor.id === id) throw new ApiError(400, 'No puedes eliminar tu propia cuenta.');
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Usuario no encontrado');
    const e = await etiquetas(existing);
    await prisma.usuario.delete({ where: { id } });
    return { detalle: `Usuario "${existing.nombre}" (rol ${e.rol}) eliminado` };
  },
};
