import { describe, expect, it } from 'vitest';
import { ApiError } from '../ApiError';
import { Permiso, ROLES, distritoDeAlcance, tienePermiso } from '../permisos';

// La matriz del diseño (informe de prácticas), fila por fila. Si alguien cambia PERMISOS_POR_ROL,
// esta tabla es la que tiene que cambiar a la vez, a propósito.
const MATRIZ: Record<string, Partial<Record<Permiso, boolean>>> = {
  [ROLES.RESPONSABLE]: { usuarios: true, auditoria: true, membresia: true, asambleas: true },
  [ROLES.OBISPO_REGIONAL]: { usuarios: false, auditoria: false, membresia: true, asambleas: true },
  [ROLES.OBISPO_DISTRITAL]: { usuarios: false, auditoria: false, membresia: true, asambleas: true },
};

describe('matriz de permisos', () => {
  for (const [rol, permisos] of Object.entries(MATRIZ)) {
    for (const [permiso, esperado] of Object.entries(permisos)) {
      it(`${rol} ${esperado ? 'puede' : 'no puede'}: ${permiso}`, () => {
        expect(tienePermiso(rol, permiso as Permiso)).toBe(esperado);
      });
    }
  }

  it('distritos y ministerios: solo Responsable y Obispo regional', () => {
    expect(tienePermiso(ROLES.RESPONSABLE, 'organizacion')).toBe(true);
    expect(tienePermiso(ROLES.OBISPO_REGIONAL, 'organizacion')).toBe(true);
    expect(tienePermiso(ROLES.OBISPO_DISTRITAL, 'organizacion')).toBe(false);
    expect(tienePermiso(ROLES.EDITOR, 'organizacion')).toBe(false);
  });

  it('eventos y comunicados: Responsable, Obispo regional y Editor', () => {
    expect(tienePermiso(ROLES.RESPONSABLE, 'contenido')).toBe(true);
    expect(tienePermiso(ROLES.OBISPO_REGIONAL, 'contenido')).toBe(true);
    expect(tienePermiso(ROLES.EDITOR, 'contenido')).toBe(true);
    expect(tienePermiso(ROLES.OBISPO_DISTRITAL, 'contenido')).toBe(false);
  });

  it('el Editor no toca membresía ni datos personales', () => {
    for (const p of ['membresia', 'iglesias', 'usuarios', 'auditoria'] as const) {
      expect(tienePermiso(ROLES.EDITOR, p)).toBe(false);
    }
  });

  it('niega todo a un rol sin permisos definidos (Secretario, Tesorero, desconocido)', () => {
    for (const rol of ['Secretario Regional', 'Tesorero Regional', 'Administrador Regional', '']) {
      expect(tienePermiso(rol, 'membresia')).toBe(false);
      expect(tienePermiso(rol, 'contenido')).toBe(false);
    }
  });
});

describe('distritoDeAlcance', () => {
  it('es null (región completa) para los roles regionales aunque tengan distrito', () => {
    expect(distritoDeAlcance({ rol: ROLES.OBISPO_REGIONAL, distritoId: 3 })).toBeNull();
    expect(distritoDeAlcance({ rol: ROLES.RESPONSABLE, distritoId: null })).toBeNull();
  });

  it('devuelve el distrito del obispo distrital', () => {
    expect(distritoDeAlcance({ rol: ROLES.OBISPO_DISTRITAL, distritoId: 4 })).toBe(4);
  });

  // Si devolviera null, se leería como "alcance regional" y le abriría toda la región.
  it('corta con 403 a un obispo distrital sin distrito, en vez de darle alcance regional', () => {
    expect(() => distritoDeAlcance({ rol: ROLES.OBISPO_DISTRITAL, distritoId: null })).toThrow(ApiError);
  });
});
