import { describe, expect, it } from 'vitest';
import { createIglesiaSchema, updateIglesiaSchema } from '../iglesias.schema';

const base = { nombre: 'IDDP Ejemplo', direccion: 'Jr. Ejemplo 123', distritoId: 1 };

/** Datos parseados, o el primer mensaje de error, para afirmar sobre ambos casos igual de corto. */
function parse(schema: typeof createIglesiaSchema, entrada: unknown) {
  const result = schema.safeParse(entrada);
  return result.success
    ? { ok: true as const, data: result.data as Record<string, unknown> }
    : { ok: false as const, error: result.error.issues[0].message };
}

describe('createIglesiaSchema — ubicación', () => {
  it('extrae las coordenadas del enlace de Google Maps pegado', () => {
    const r = parse(createIglesiaSchema, {
      ...base,
      mapsUrl: 'https://www.google.com/maps/@-10.7539,-77.7614,17z',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ latitud: -10.7539, longitud: -77.7614 });
  });

  // mapsUrl es comodidad de entrada, no columna: debe desaparecer antes de llegar a Prisma o el
  // create fallaría con "Unknown argument".
  it('no deja pasar mapsUrl al payload que recibe Prisma', () => {
    const r = parse(createIglesiaSchema, {
      ...base,
      mapsUrl: 'https://www.google.com/maps/@-10.7539,-77.7614,17z',
    });
    if (r.ok) expect(r.data).not.toHaveProperty('mapsUrl');
  });

  it('acepta coordenadas escritas a mano, coercionando strings del formulario', () => {
    const r = parse(createIglesiaSchema, { ...base, latitud: '-10.75', longitud: '-77.76' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ latitud: -10.75, longitud: -77.76 });
  });

  it('da prioridad a las coordenadas explícitas sobre el enlace', () => {
    const r = parse(createIglesiaSchema, {
      ...base,
      latitud: -11.1,
      longitud: -77.1,
      mapsUrl: 'https://www.google.com/maps/@-10.7539,-77.7614,17z',
    });
    if (r.ok) expect(r.data).toMatchObject({ latitud: -11.1, longitud: -77.1 });
  });

  it('permite crear una iglesia sin ubicación', () => {
    const r = parse(createIglesiaSchema, base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.latitud).toBeUndefined();
      expect(r.data.longitud).toBeUndefined();
    }
  });

  it('trata los campos vacíos del formulario como ausentes', () => {
    const r = parse(createIglesiaSchema, {
      ...base,
      latitud: '',
      longitud: '',
      mapsUrl: '',
      ministerioId: '',
      foto: '',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.latitud).toBeUndefined();
  });

  it('explica cómo resolver un enlace corto en vez de fallar sin más', () => {
    const r = parse(createIglesiaSchema, { ...base, mapsUrl: 'https://maps.app.goo.gl/xYz123' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('enlace corto');
  });

  it('rechaza media coordenada, que no ubica nada', () => {
    const r = parse(createIglesiaSchema, { ...base, latitud: -10.75 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('juntas');
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(parse(createIglesiaSchema, { ...base, latitud: 200, longitud: -77 }).ok).toBe(false);
    expect(parse(createIglesiaSchema, { ...base, latitud: -10, longitud: 400 }).ok).toBe(false);
  });
});

describe('updateIglesiaSchema', () => {
  it('acepta actualizar solo la ubicación pegando el enlace', () => {
    const r = parse(updateIglesiaSchema, {
      mapsUrl:
        'https://www.google.com/maps/place/X/@-10.70,-77.70,15z/data=!4m6!3m5!3d-10.7539!4d-77.7614',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ latitud: -10.7539, longitud: -77.7614 });
  });

  it('acepta actualizar un campo suelto sin tocar la ubicación', () => {
    const r = parse(updateIglesiaSchema, { nombre: 'Nuevo nombre' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ nombre: 'Nuevo nombre' });
  });
});
