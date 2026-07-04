import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { LoginInput } from './auth.schema';

const JWT_EXPIRES_IN = '2h';

function sanitizeUsuario(usuario: { id: number; nombre: string; email: string | null; rolId: number; estadoId: number }) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rolId: usuario.rolId,
    estadoId: usuario.estadoId,
  };
}

export async function login(input: LoginInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { nombre: input.nombre },
    include: { estado: true },
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
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return sanitizeUsuario(usuario);
}
