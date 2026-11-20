import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db/prisma', () => ({ prisma: {} }));

import { LimiteVentana } from '../votacion.limites';
import { EstadoVotacion, etagElector, estadoParaElector, vistaElector } from '../votacion.estado';
import { esCodigoAccesoValido, generarCodigoAcceso, generarCodigoElector } from '../../../utils/codigos';

function estado(extra: Partial<EstadoVotacion> = {}): EstadoVotacion {
  return {
    asambleaId: 1,
    codigo: 'ABCDEF',
    nombre: 'Asamblea',
    estadoAsamblea: 'EN_CURSO',
    eleccion: { id: 7, cargo: 'Tesorero', ronda: 1 },
    siguienteCargo: null,
    version: 3,
    votaron: new Set([10]),
    cargadoEn: Date.now(),
    ...extra,
  };
}

describe('LimiteVentana', () => {
  it('deja pasar hasta el máximo y corta el siguiente', () => {
    const l = new LimiteVentana(3, 1000);
    expect([1, 2, 3].map(() => l.consumir('a', 0))).toEqual([true, true, true]);
    expect(l.consumir('a', 10)).toBe(false);
    expect(l.bloqueado('a', 10)).toBe(true);
  });

  it('cada clave (sesión o DNI) tiene su propia cuenta', () => {
    const l = new LimiteVentana(1, 1000);
    expect(l.consumir('e1', 0)).toBe(true);
    expect(l.consumir('e2', 0)).toBe(true);
    expect(l.consumir('e1', 0)).toBe(false);
  });

  it('se renueva al terminar la ventana y se puede reiniciar', () => {
    const l = new LimiteVentana(1, 1000);
    l.consumir('a', 0);
    expect(l.consumir('a', 500)).toBe(false);
    expect(l.consumir('a', 1000)).toBe(true);
    l.consumir('a', 1001);
    l.reiniciar('a');
    expect(l.bloqueado('a', 1002)).toBe(false);
  });
});

describe('códigos', () => {
  it('el código de acceso tiene 6 caracteres sin ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigoAcceso();
      expect(esCodigoAccesoValido(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it('el código del elector son siempre 4 dígitos, con ceros a la izquierda', () => {
    for (let i = 0; i < 500; i++) expect(generarCodigoElector()).toMatch(/^\d{4}$/);
  });

  it('rechaza códigos de acceso mal formados', () => {
    expect(esCodigoAccesoValido('ABC')).toBe(false);
    expect(esCodigoAccesoValido('ABCDE0')).toBe(false);
    expect(esCodigoAccesoValido('abcdef')).toBe(false);
  });
});

describe('vista del elector', () => {
  it('es mínima: estado, elección, versión y si ya votó; nunca conteos', () => {
    expect(vistaElector(estado(), 10)).toEqual({ estado: 'ABIERTA', eleccionId: 7, version: 3, yaVoto: true });
    expect(vistaElector(estado(), 11).yaVoto).toBe(false);
  });

  it('sin elección abierta espera; con la asamblea finalizada, termina', () => {
    expect(estadoParaElector(estado({ eleccion: null }))).toBe('ESPERA');
    expect(estadoParaElector(estado({ estadoAsamblea: 'FINALIZADA' }))).toBe('FINALIZADA');
  });

  it('el ETag cambia con la versión y con el voto del propio elector', () => {
    const e = estado();
    expect(etagElector(e, 10)).not.toBe(etagElector(e, 11));
    expect(etagElector(e, 11)).not.toBe(etagElector({ ...e, version: 4 }, 11));
  });
});
