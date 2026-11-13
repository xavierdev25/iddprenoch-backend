import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const { usuarioFindUnique, auditoriaCreate } = vi.hoisted(() => ({
  usuarioFindUnique: vi.fn(),
  auditoriaCreate: vi.fn(),
}));
vi.mock('../../db/prisma', () => ({
  prisma: { usuario: { findUnique: usuarioFindUnique }, auditoria: { create: auditoriaCreate } },
}));

import { AUTH_COOKIE_NAME, requireAuth, requirePermiso, vistaPanel } from '../auth.middleware';

const token = jwt.sign({ id: 5, nombre: 'ana', rolId: 2 }, process.env.JWT_SECRET!);

function llamar(mw: (req: Request, res: Response, next: NextFunction) => void, req: Partial<Request>) {
  return new Promise<{ err: unknown; req: Request }>((resolve) => {
    const r = { method: 'GET', originalUrl: '/api/x', query: {}, cookies: {}, ...req } as Request;
    const res = { set: vi.fn() } as unknown as Response;
    mw(r, res, (err?: unknown) => resolve({ err, req: r }));
  });
}

function usuarioEnBase(rol: string, estado: string, distritoId: number | null = null) {
  return { id: 5, nombre: 'ana', rolId: 3, distritoId, rol: { nombre: rol }, estado: { nombre: estado } };
}

beforeEach(() => {
  usuarioFindUnique.mockReset();
  auditoriaCreate.mockReset().mockResolvedValue({});
});

describe('requireAuth', () => {
  it('resuelve rol y distrito desde la base, no desde el token', async () => {
    usuarioFindUnique.mockResolvedValue(usuarioEnBase('Obispo distrital', 'Activo', 2));
    const { err, req } = await llamar(requireAuth, { cookies: { [AUTH_COOKIE_NAME]: token } });
    expect(err).toBeUndefined();
    expect(req.user).toEqual({ id: 5, nombre: 'ana', rolId: 3, rol: 'Obispo distrital', distritoId: 2 });
  });

  // El token sigue vigente 2 h, pero la desactivación debe regir en la request siguiente.
  it('bloquea al instante a un usuario desactivado con token vigente', async () => {
    usuarioFindUnique.mockResolvedValue(usuarioEnBase('Editor', 'Inactivo'));
    const { err } = await llamar(requireAuth, { cookies: { [AUTH_COOKIE_NAME]: token } });
    expect(err).toMatchObject({ statusCode: 401 });
  });

  it('rechaza a un usuario borrado con token vigente', async () => {
    usuarioFindUnique.mockResolvedValue(null);
    const { err } = await llamar(requireAuth, { cookies: { [AUTH_COOKIE_NAME]: token } });
    expect(err).toMatchObject({ statusCode: 401 });
  });

  it('rechaza sin cookie y con un token firmado con otro secreto', async () => {
    expect((await llamar(requireAuth, {})).err).toMatchObject({ statusCode: 401 });
    const falso = jwt.sign({ id: 5 }, 'otro-secreto-cualquiera');
    expect((await llamar(requireAuth, { cookies: { [AUTH_COOKIE_NAME]: falso } })).err).toMatchObject({
      statusCode: 401,
    });
    expect(usuarioFindUnique).not.toHaveBeenCalled();
  });
});

describe('requirePermiso', () => {
  const user = { id: 9, nombre: 'ed', rolId: 4, rol: 'Editor', distritoId: null };

  it('deja pasar a un rol con el permiso, sin auditar', async () => {
    expect((await llamar(requirePermiso('contenido'), { user })).err).toBeUndefined();
    expect(auditoriaCreate).not.toHaveBeenCalled();
  });

  it('responde 403 y registra el acceso denegado', async () => {
    const { err } = await llamar(requirePermiso('membresia'), { user, ip: '9.9.9.9' });
    expect(err).toMatchObject({ statusCode: 403 });
    expect(auditoriaCreate.mock.calls[0][0].data).toMatchObject({
      usuarioId: 9,
      resultado: 'DENEGADO',
      ip: '9.9.9.9',
    });
  });
});

describe('vistaPanel', () => {
  // Un obispo distrital con sesión abierta debe ver el sitio público completo, no su distrito.
  it('sin ?ambito=panel no lee la cookie: la request sigue siendo pública', async () => {
    const { err, req } = await llamar(vistaPanel('iglesias'), { cookies: { [AUTH_COOKIE_NAME]: token } });
    expect(err).toBeUndefined();
    expect(req.user).toBeUndefined();
    expect(usuarioFindUnique).not.toHaveBeenCalled();
  });

  it('con ?ambito=panel exige sesión', async () => {
    const { err } = await llamar(vistaPanel('iglesias'), { query: { ambito: 'panel' } });
    expect(err).toMatchObject({ statusCode: 401 });
  });

  it('con ?ambito=panel exige además el permiso', async () => {
    usuarioFindUnique.mockResolvedValue(usuarioEnBase('Editor', 'Activo'));
    const { err } = await llamar(vistaPanel('iglesias'), {
      query: { ambito: 'panel' },
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    expect(err).toMatchObject({ statusCode: 403 });
  });
});
