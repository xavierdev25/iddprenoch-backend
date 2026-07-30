import { describe, expect, it } from 'vitest';
import {
  FechaCivil,
  calcularEdad,
  clasificarGrupoEtario,
  fechaCivilHoy,
  grupoEtarioDeFecha,
  rangoFechaNacimiento,
} from '../edad';

/** Fecha de nacimiento tal como Prisma devuelve una columna `@db.Date`: medianoche UTC. */
const nacido = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const HOY: FechaCivil = { anio: 2026, mes: 7, dia: 29 };

describe('calcularEdad', () => {
  it('devuelve undefined si no hay fecha registrada', () => {
    expect(calcularEdad(null, HOY)).toBeUndefined();
    expect(calcularEdad(undefined, HOY)).toBeUndefined();
  });

  it('cuenta los años cumplidos cuando el cumpleaños ya pasó este año', () => {
    expect(calcularEdad(nacido('1990-03-15'), HOY)).toBe(36);
  });

  it('descuenta un año cuando el cumpleaños todavía no llega', () => {
    expect(calcularEdad(nacido('1990-11-15'), HOY)).toBe(35);
  });

  it('cuenta el año el mismo día del cumpleaños', () => {
    expect(calcularEdad(nacido('2000-07-29'), HOY)).toBe(26);
  });

  it('no cuenta el año un día antes del cumpleaños', () => {
    expect(calcularEdad(nacido('2000-07-30'), HOY)).toBe(25);
  });

  // Con getters locales en una zona de offset negativo (Perú, UTC-5), la medianoche UTC del
  // 10 de mayo se leería como 9 de mayo y desplazaría la edad alrededor del cumpleaños.
  it('lee la fecha en UTC, sin corrimiento por zona horaria', () => {
    expect(calcularEdad(nacido('2000-07-29'), { anio: 2026, mes: 7, dia: 29 })).toBe(26);
    expect(calcularEdad(nacido('2000-07-29'), { anio: 2026, mes: 7, dia: 28 })).toBe(25);
  });

  it('trata una fecha futura mal tipeada como desconocida', () => {
    expect(calcularEdad(nacido('2030-01-01'), HOY)).toBeUndefined();
  });

  it('devuelve 0 para un recién nacido, no undefined', () => {
    expect(calcularEdad(nacido('2026-07-01'), HOY)).toBe(0);
  });
});

describe('clasificarGrupoEtario', () => {
  it('clasifica cada tramo por su edad', () => {
    expect(clasificarGrupoEtario(0)).toBe('nino');
    expect(clasificarGrupoEtario(11)).toBe('nino');
    expect(clasificarGrupoEtario(12)).toBe('adolescente');
    expect(clasificarGrupoEtario(17)).toBe('adolescente');
    expect(clasificarGrupoEtario(18)).toBe('joven');
    expect(clasificarGrupoEtario(30)).toBe('joven');
    expect(clasificarGrupoEtario(31)).toBe('adulto');
    expect(clasificarGrupoEtario(98)).toBe('adulto');
  });

  it('separa a quien no tiene fecha de nacimiento registrada', () => {
    expect(clasificarGrupoEtario(undefined)).toBe('sin_fecha');
  });

  it('no cuenta como niño a quien no tiene fecha registrada', () => {
    expect(grupoEtarioDeFecha(null, HOY)).toBe('sin_fecha');
    expect(grupoEtarioDeFecha(nacido('2020-01-01'), HOY)).toBe('nino');
  });
});

describe('rangoFechaNacimiento', () => {
  const iso = (fecha: Date | undefined) => fecha?.toISOString().slice(0, 10);

  it('acota un grupo cerrado por ambos extremos', () => {
    const rango = rangoFechaNacimiento('joven', HOY);
    // Joven = 18..30 años: nacido a más tardar el 2008-07-29 y después del 1995-07-29.
    expect(iso(rango?.lte)).toBe('2008-07-29');
    expect(iso(rango?.gt)).toBe('1995-07-29');
  });

  it('deja abierto el extremo inferior de un grupo sin edad máxima', () => {
    const rango = rangoFechaNacimiento('adulto', HOY);
    expect(iso(rango?.lte)).toBe('1995-07-29');
    expect(rango?.gt).toBeUndefined();
  });

  it('devuelve null para sin_fecha, que no es un rango de fechas', () => {
    expect(rangoFechaNacimiento('sin_fecha', HOY)).toBeNull();
  });

  // El rango SQL y la clasificación en Node deben coincidir: si difieren, el total del reporte
  // filtrado por grupo no cuadra con el grupo que muestra cada fila.
  it('coincide con clasificarGrupoEtario en los bordes de cada grupo', () => {
    for (const clave of ['nino', 'adolescente', 'joven', 'adulto'] as const) {
      const rango = rangoFechaNacimiento(clave, HOY);
      expect(grupoEtarioDeFecha(rango!.lte, HOY)).toBe(clave);
      if (rango?.gt) {
        const primerDiaIncluido = new Date(rango.gt.getTime() + 24 * 60 * 60 * 1000);
        expect(grupoEtarioDeFecha(primerDiaIncluido, HOY)).toBe(clave);
        // Justo el límite excluido ya pertenece al grupo siguiente.
        expect(grupoEtarioDeFecha(rango.gt, HOY)).not.toBe(clave);
      }
    }
  });
});

describe('fechaCivilHoy', () => {
  // A las 02:00 UTC del día 30 en Perú (UTC-5) todavía es el 29: usar la fecha UTC adelantaría
  // los cumpleaños un día en cualquier reporte generado de tarde/noche.
  it('usa la fecha civil de Perú, no la del servidor en UTC', () => {
    expect(fechaCivilHoy(new Date('2026-07-30T02:00:00.000Z'))).toEqual({
      anio: 2026,
      mes: 7,
      dia: 29,
    });
  });

  it('devuelve el mismo día cuando ambas zonas coinciden', () => {
    expect(fechaCivilHoy(new Date('2026-07-29T15:00:00.000Z'))).toEqual({
      anio: 2026,
      mes: 7,
      dia: 29,
    });
  });
});
