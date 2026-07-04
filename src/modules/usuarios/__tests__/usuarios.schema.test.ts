import { describe, expect, it } from 'vitest';
import { createUsuarioSchema, updateUsuarioSchema } from '../usuarios.schema';

const validBase = { nombre: 'Ana', rolId: 1, estadoId: 1 };

describe('createUsuarioSchema — password requerido', () => {
  it('rechaza sin password', () => {
    expect(createUsuarioSchema.safeParse(validBase).success).toBe(false);
  });

  it('rechaza password de menos de 8 caracteres', () => {
    expect(createUsuarioSchema.safeParse({ ...validBase, password: 'short1' }).success).toBe(false);
  });

  it('acepta con password válido (>= 8 caracteres)', () => {
    const result = createUsuarioSchema.safeParse({ ...validBase, password: 'password123' });
    expect(result.success).toBe(true);
  });
});

describe('updateUsuarioSchema — password opcional', () => {
  it('acepta sin password (no se cambia)', () => {
    expect(updateUsuarioSchema.safeParse(validBase).success).toBe(true);
  });

  it('rechaza password de menos de 8 caracteres si se manda', () => {
    expect(updateUsuarioSchema.safeParse({ password: 'short1' }).success).toBe(false);
  });

  it('acepta password válido si se manda', () => {
    const result = updateUsuarioSchema.safeParse({ password: 'nuevaPassword1' });
    expect(result.success).toBe(true);
  });
});
