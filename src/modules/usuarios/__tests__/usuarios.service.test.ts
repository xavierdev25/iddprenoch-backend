import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db/prisma', () => ({ prisma: { usuario: {} } }));

import { ApiError } from '../../../utils/ApiError';
import { describirCambios, distritoSegunRol } from '../usuarios.service';

describe('distritoSegunRol', () => {
  it('exige distrito al Obispo distrital', () => {
    expect(() => distritoSegunRol('Obispo distrital', null)).toThrow(ApiError);
    expect(() => distritoSegunRol('Obispo distrital', undefined)).toThrow(ApiError);
    expect(distritoSegunRol('Obispo distrital', 4)).toBe(4);
  });

  // Pasar a alguien de distrital a regional no debe exigir además borrar el distrito a mano.
  it('descarta el distrito de los roles de alcance regional', () => {
    expect(distritoSegunRol('Obispo regional', 4)).toBeNull();
    expect(distritoSegunRol('Responsable del sistema', 4)).toBeNull();
    expect(distritoSegunRol('Editor', null)).toBeNull();
  });
});

describe('describirCambios', () => {
  const base = { nombre: 'ana', email: null, rol: 'Editor', estado: 'Activo', distrito: 'ninguno' };

  it('dice quién pasó de qué rol a cuál', () => {
    expect(describirCambios(base, { ...base, rol: 'Obispo distrital', distrito: 'Huaral' }, false)).toBe(
      'rol: Editor → Obispo distrital; distrito: ninguno → Huaral',
    );
  });

  it('registra que cambió la contraseña sin registrar la contraseña', () => {
    expect(describirCambios(base, base, true)).toBe('contraseña cambiada');
  });

  it('indica cuando no hubo cambios', () => {
    expect(describirCambios(base, base, false)).toBe('sin cambios');
  });
});
