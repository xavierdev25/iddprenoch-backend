import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { ROLES } from '../permisos';

const { iglesiaFindUnique, auditoriaCreate } = vi.hoisted(() => ({
  iglesiaFindUnique: vi.fn(),
  auditoriaCreate: vi.fn(),
}));
vi.mock('../../db/prisma', () => ({
  prisma: { iglesia: { findUnique: iglesiaFindUnique }, auditoria: { create: auditoriaCreate } },
}));

import {
  aplicarAlcanceAFiltros,
  exigirDistritoEnAlcance,
  whereIglesiaEnAlcance,
  whereRelacionIglesiaEnAlcance,
} from '../alcance';

function req(user?: { rol: string; distritoId: number | null }): Request {
  return {
    user: user && { id: 7, nombre: 'u', rolId: 1, ...user },
    method: 'GET',
    originalUrl: '/api/congregantes?q=12345678',
    ip: '1.2.3.4',
  } as unknown as Request;
}

const distrital = req({ rol: ROLES.OBISPO_DISTRITAL, distritoId: 2 });
const regional = req({ rol: ROLES.OBISPO_REGIONAL, distritoId: null });

beforeEach(() => {
  iglesiaFindUnique.mockReset();
  auditoriaCreate.mockReset().mockResolvedValue({});
});

describe('where de alcance', () => {
  it('no agrega condición para el alcance regional ni para el público anónimo', () => {
    expect(whereRelacionIglesiaEnAlcance(regional)).toEqual({});
    expect(whereIglesiaEnAlcance(req())).toEqual({});
  });

  it('acota al obispo distrital a través de la iglesia', () => {
    expect(whereRelacionIglesiaEnAlcance(distrital)).toEqual({ iglesia: { distritoId: 2 } });
    expect(whereIglesiaEnAlcance(distrital)).toEqual({ distritoId: 2 });
  });
});

describe('aplicarAlcanceAFiltros', () => {
  it('deja intactos los filtros de un usuario regional', async () => {
    expect(await aplicarAlcanceAFiltros(regional, { distritoId: 5, sexoId: 1 })).toEqual({ distritoId: 5, sexoId: 1 });
  });

  it('fuerza el distrito propio cuando el obispo distrital no filtra por distrito', async () => {
    expect(await aplicarAlcanceAFiltros(distrital, { sexoId: 1 })).toEqual({ sexoId: 1, distritoId: 2 });
  });

  it('acepta que pida explícitamente su propio distrito', async () => {
    expect(await aplicarAlcanceAFiltros(distrital, { distritoId: 2 })).toEqual({ distritoId: 2 });
  });

  it('responde 403 y audita si pide otro distrito', async () => {
    await expect(aplicarAlcanceAFiltros(distrital, { distritoId: 3 })).rejects.toMatchObject({ statusCode: 403 });
    expect(auditoriaCreate).toHaveBeenCalledOnce();
    const data = auditoriaCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ usuarioId: 7, resultado: 'DENEGADO', ip: '1.2.3.4' });
    // El query (?q=DNI) no debe copiarse a la auditoría.
    expect(data.recurso).toBe('/api/congregantes');
  });

  it('responde 403 si pide una iglesia de otro distrito', async () => {
    iglesiaFindUnique.mockResolvedValue({ distritoId: 9 });
    await expect(aplicarAlcanceAFiltros(distrital, { iglesiaId: 40 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('acepta una iglesia de su distrito', async () => {
    iglesiaFindUnique.mockResolvedValue({ distritoId: 2 });
    expect(await aplicarAlcanceAFiltros(distrital, { iglesiaId: 40 })).toEqual({ iglesiaId: 40, distritoId: 2 });
  });

  it('una iglesia inexistente no es un 403: el distrito forzado deja la lista vacía', async () => {
    iglesiaFindUnique.mockResolvedValue(null);
    expect(await aplicarAlcanceAFiltros(distrital, { iglesiaId: 999 })).toEqual({ iglesiaId: 999, distritoId: 2 });
  });
});

describe('exigirDistritoEnAlcance', () => {
  it('deja pasar al alcance regional con cualquier distrito', async () => {
    await expect(exigirDistritoEnAlcance(regional, 9)).resolves.toBeUndefined();
  });

  it('deja pasar al obispo distrital en su distrito', async () => {
    await expect(exigirDistritoEnAlcance(distrital, 2)).resolves.toBeUndefined();
  });

  it('deniega otro distrito', async () => {
    await expect(exigirDistritoEnAlcance(distrital, 3)).rejects.toMatchObject({ statusCode: 403 });
  });

  // Ante la duda (iglesia destino inexistente) se deniega, no se deja pasar.
  it('deniega un distrito desconocido', async () => {
    await expect(exigirDistritoEnAlcance(distrital, undefined)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('sigue respondiendo 403 aunque falle la escritura de la auditoría', async () => {
    auditoriaCreate.mockRejectedValue(new Error('db caída'));
    await expect(exigirDistritoEnAlcance(distrital, 3)).rejects.toMatchObject({ statusCode: 403 });
  });
});
