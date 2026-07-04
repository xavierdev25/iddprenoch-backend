import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emailField, urlField } from '../schemaHelpers';

describe('urlField', () => {
  const schema = z.object({ foto: urlField('foto') });

  it('acepta "" (campo opcional dejado vacío en el form) como ausente', () => {
    const result = schema.safeParse({ foto: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.foto).toBeUndefined();
  });

  it('acepta undefined', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('acepta una URL válida', () => {
    const result = schema.safeParse({ foto: 'https://ejemplo.pe/foto.jpg' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.foto).toBe('https://ejemplo.pe/foto.jpg');
  });

  it('rechaza un string no vacío que no es una URL', () => {
    expect(schema.safeParse({ foto: 'no-es-una-url' }).success).toBe(false);
  });
});

describe('emailField', () => {
  const schema = z.object({ correo: emailField('correo') });

  it('acepta "" como ausente', () => {
    const result = schema.safeParse({ correo: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.correo).toBeUndefined();
  });

  it('acepta un email válido', () => {
    const result = schema.safeParse({ correo: 'persona@ejemplo.pe' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.correo).toBe('persona@ejemplo.pe');
  });

  it('rechaza un string no vacío que no es un email', () => {
    expect(schema.safeParse({ correo: 'no-es-un-correo' }).success).toBe(false);
  });
});
