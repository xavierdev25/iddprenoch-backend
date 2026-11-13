import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { LoginInput } from './auth.schema';

const JWT_EXPIRES_IN = '2h';

interface UsuarioConRol {
  id: number;
  nombre: string;
  email: string | null;
  rolId: number;
  estadoId: number;
  distritoId: number | null;
  rol: { nombre: string };
}

// `rol` y `distritoId` se agregaron con el control de acceso (ADR-026): el panel los usa para
// mostrar solo lo que el usuario puede hacer. Son campos nuevos; los existentes no cambian.
function sanitizeUsuario(usuario: UsuarioConRol) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rolId: usuario.rolId,
    estadoId: usuario.estadoId,
    rol: usuario.rol.nombre,
    distritoId: usuario.distritoId,
  };
}

export async function login(input: LoginInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { nombre: input.nombre },
    include: { estado: true, rol: { select: { nombre: true } } },
  });

  if (!usuario) {
    throw new ApiError(401, 'Credenciales inválidas');
  }

  const passwordMatches = await bcrypt.compare(input.password, usuario.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Credenciales inválidas');
  }

  if (usuario.estado.nombre !== 'Activo') {
    throw new ApiError(401, 'Usuario inactivo');
  }

  const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, rolId: usuario.rolId }, env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { token, user: sanitizeUsuario(usuario) };
}

export async function getCurrentUser(id: number) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: { select: { nombre: true } } } });
  if (!usuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return sanitizeUsuario(usuario);
}
