import { describe, expect, it } from 'vitest';
import { calcularResultado, porcentaje } from '../resultados';

const c = (...votos: number[]) => votos.map((v, i) => ({ candidatoId: i + 1, votos: v }));

describe('calcularResultado', () => {
  it('gana quien tiene más votos (mayoría simple)', () => {
    expect(calcularResultado(c(17, 13, 8))).toEqual({ ganadorId: 1, empatados: [], total: 38 });
  });

  it('empate en el primer lugar: sin ganador, solo los empatados', () => {
    expect(calcularResultado(c(5, 9, 9, 2))).toEqual({ ganadorId: null, empatados: [2, 3], total: 25 });
  });

  it('un empate por debajo del primer lugar no importa', () => {
    expect(calcularResultado(c(10, 4, 4)).ganadorId).toBe(1);
  });

  it('sin votos, todos empatan en cero', () => {
    expect(calcularResultado(c(0, 0))).toEqual({ ganadorId: null, empatados: [1, 2], total: 0 });
  });

  it('candidato único: gana con al menos un voto', () => {
    expect(calcularResultado(c(3)).ganadorId).toBe(1);
    expect(calcularResultado(c(0)).ganadorId).toBeNull();
  });

  it('sin candidatos no hay resultado', () => {
    expect(calcularResultado([])).toEqual({ ganadorId: null, empatados: [], total: 0 });
  });
});

describe('porcentaje', () => {
  it('redondea a un decimal y no divide por cero', () => {
    expect(porcentaje(17, 38)).toBe(44.7);
    expect(porcentaje(0, 0)).toBe(0);
  });
});
