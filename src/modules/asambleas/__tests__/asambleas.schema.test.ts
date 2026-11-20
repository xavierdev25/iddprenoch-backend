import { describe, expect, it } from 'vitest';
import { asambleaEnAlcance } from '../asambleas.alcance';
import { asambleaSchema, candidatoSchema } from '../asambleas.schema';

describe('asambleaSchema', () => {
  const base = { nombre: 'Asamblea 2026', fecha: '2026-12-05' };

  it('exige distrito solo en las distritales', () => {
    expect(asambleaSchema.safeParse({ ...base, tipo: 'DISTRITAL', distritoId: 2 }).success).toBe(true);
    expect(asambleaSchema.safeParse({ ...base, tipo: 'DISTRITAL' }).success).toBe(false);
    expect(asambleaSchema.safeParse({ ...base, tipo: 'REGIONAL' }).success).toBe(true);
    expect(asambleaSchema.safeParse({ ...base, tipo: 'REGIONAL', distritoId: 2 }).success).toBe(false);
  });
});

describe('candidatoSchema', () => {
  it('acepta solo imágenes PNG, JPG o WEBP como foto', () => {
    expect(candidatoSchema.safeParse({ nombre: 'Ana Pérez', foto: 'data:image/jpeg;base64,AAAA' }).success).toBe(true);
    expect(candidatoSchema.safeParse({ nombre: 'Ana Pérez', foto: 'data:image/svg+xml;base64,AAAA' }).success).toBe(false);
    expect(candidatoSchema.safeParse({ nombre: 'Ana Pérez', foto: '' }).success).toBe(true);
  });
});

describe('asambleaEnAlcance', () => {
  it('el alcance regional opera cualquier asamblea', () => {
    expect(asambleaEnAlcance(null, { tipo: 'REGIONAL', distritoId: null })).toBe(true);
  });

  it('el obispo distrital solo opera las distritales de su distrito', () => {
    expect(asambleaEnAlcance(2, { tipo: 'DISTRITAL', distritoId: 2 })).toBe(true);
    expect(asambleaEnAlcance(2, { tipo: 'DISTRITAL', distritoId: 3 })).toBe(false);
    expect(asambleaEnAlcance(2, { tipo: 'REGIONAL', distritoId: null })).toBe(false);
  });
});
