import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../utils/ApiError';
import {
  construirWhereCongregantes,
  parseFiltrosCongregantes,
} from '../congregantes.filters';

describe('parseFiltrosCongregantes', () => {
  it('coerciona los ids que llegan como string en el query', () => {
    expect(parseFiltrosCongregantes({ iglesiaId: '61' })).toMatchObject({ iglesiaId: 61 });
  });

  it('ignora los selects sin elegir ("") en vez de tomarlos como 0', () => {
    const filtros = parseFiltrosCongregantes({ iglesiaId: '', ministerioId: '', q: '' });
    expect(filtros.iglesiaId).toBeUndefined();
    expect(filtros.ministerioId).toBeUndefined();
    expect(filtros.q).toBeUndefined();
  });

  it('descarta los parámetros ajenos, como la paginación', () => {
    expect(parseFiltrosCongregantes({ page: '2', limit: '50' })).toEqual({});
  });

  // Si un filtro mal escrito se ignorara, el reporte devolvería la membresía completa presentada
  // como resultado filtrado y nadie leyendo el Excel lo notaría.
  it('rechaza un grupo etario inválido en vez de ignorarlo', () => {
    expect(() => parseFiltrosCongregantes({ grupoEtario: 'jovenes' })).toThrow(ApiError);
  });

  it('rechaza un id no numérico', () => {
    expect(() => parseFiltrosCongregantes({ iglesiaId: 'abc' })).toThrow(ApiError);
  });

  it('rechaza un id negativo', () => {
    expect(() => parseFiltrosCongregantes({ iglesiaId: '-3' })).toThrow(ApiError);
  });
});

describe('construirWhereCongregantes', () => {
  it('no filtra nada cuando no hay filtros', () => {
    expect(construirWhereCongregantes({})).toEqual({});
  });

  it('mapea los ids directos a columnas del congregante', () => {
    expect(
      construirWhereCongregantes({ iglesiaId: 61, ministerioId: 3, sexoId: 1, estadoEclesialId: 2 }),
    ).toMatchObject({ iglesiaId: 61, ministerioId: 3, sexoId: 1, estadoEclesialId: 2 });
  });

  // El distrito no es columna de congregantes: su única fuente es la iglesia a la que pertenece.
  it('filtra el distrito a través de la relación con la iglesia', () => {
    expect(construirWhereCongregantes({ distritoId: 4 })).toEqual({
      iglesia: { distritoId: 4 },
    });
  });

  it('traduce el grupo etario a un rango de fecha de nacimiento', () => {
    const where = construirWhereCongregantes({ grupoEtario: 'joven' });
    const rango = where.fechaNacimiento as { gt: Date; lte: Date };
    expect(rango.lte).toBeInstanceOf(Date);
    expect(rango.gt).toBeInstanceOf(Date);
    expect(rango.gt.getTime()).toBeLessThan(rango.lte.getTime());
  });

  it('traduce sin_fecha a una comparación con NULL, no a un rango', () => {
    expect(construirWhereCongregantes({ grupoEtario: 'sin_fecha' })).toEqual({
      fechaNacimiento: null,
    });
  });

  it('busca el texto libre en nombre, apellido y DNI', () => {
    const where = construirWhereCongregantes({ q: 'perez' });
    expect(where.OR).toEqual([
      { nombre: { contains: 'perez' } },
      { apellido: { contains: 'perez' } },
      { dni: { contains: 'perez' } },
    ]);
  });

  it('combina varios filtros en un solo where', () => {
    const where = construirWhereCongregantes({ distritoId: 4, sexoId: 1, grupoEtario: 'nino' });
    expect(where).toMatchObject({ iglesia: { distritoId: 4 }, sexoId: 1 });
    expect(where.fechaNacimiento).toBeDefined();
  });
});
