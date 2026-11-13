import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

vi.mock('../../db/prisma', () => ({ prisma: {} }));

import { fechaCorteRetencion, recursoDe } from '../auditoria';

describe('fechaCorteRetencion', () => {
  it('conserva exactamente 12 meses', () => {
    expect(fechaCorteRetencion(new Date('2026-11-13T10:00:00Z')).toISOString()).toBe('2025-11-13T10:00:00.000Z');
  });
});

describe('recursoDe', () => {
  it('descarta el query string, que puede traer un DNI buscado', () => {
    expect(recursoDe({ originalUrl: '/api/congregantes?q=12345678&page=2' } as Request)).toBe('/api/congregantes');
  });
});
