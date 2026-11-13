import { ApiError } from './ApiError';

/**
 * Matriz de permisos por rol (ADR-026).
 *
 * Los roles se reconocen por nombre y no por id: los ids difieren entre la base de desarrollo, la
 * del CI y la de producción, y la tabla `roles` no se edita desde el panel (solo por migración y
 * seed), así que el nombre es el identificador estable.
 */
export const ROLES = {
  RESPONSABLE: 'Responsable del sistema',
  OBISPO_REGIONAL: 'Obispo regional',
  OBISPO_DISTRITAL: 'Obispo distrital',
  EDITOR: 'Editor',
} as const;

/**
 * - `usuarios`: cuentas, roles y distritos asignados.
 * - `auditoria`: consulta del registro de auditoría.
 * - `membresia`: congregantes y reportes de membresía (datos personales).
 * - `iglesias`: iglesias, pastores y líderes desde el panel.
 * - `organizacion`: distritos, ministerios y cargos (la estructura regional).
 * - `contenido`: eventos y comunicados del sitio público.
 * - `asambleas`: asambleas y conteo en vivo (Sprint 2).
 */
export type Permiso =
  | 'usuarios'
  | 'auditoria'
  | 'membresia'
  | 'iglesias'
  | 'organizacion'
  | 'contenido'
  | 'asambleas';

// Un rol que no figura aquí (Secretario Regional, Tesorero Regional o cualquier otro) no tiene
// ningún permiso: denegar por defecto es lo que evita que un rol nuevo herede acceso sin querer.
const PERMISOS_POR_ROL: Record<string, readonly Permiso[]> = {
  [ROLES.RESPONSABLE]: ['usuarios', 'auditoria', 'membresia', 'iglesias', 'organizacion', 'contenido', 'asambleas'],
  [ROLES.OBISPO_REGIONAL]: ['membresia', 'iglesias', 'organizacion', 'contenido', 'asambleas'],
  [ROLES.OBISPO_DISTRITAL]: ['membresia', 'iglesias', 'asambleas'],
  [ROLES.EDITOR]: ['contenido'],
};

export function permisosDe(rol: string): readonly Permiso[] {
  return PERMISOS_POR_ROL[rol] ?? [];
}

export function tienePermiso(rol: string, permiso: Permiso): boolean {
  return permisosDe(rol).includes(permiso);
}

/** Solo el obispo distrital tiene alcance acotado; los demás roles ven la región completa. */
export function esRolDistrital(rol: string): boolean {
  return rol === ROLES.OBISPO_DISTRITAL;
}

/**
 * Distrito que acota lo que el usuario puede ver y tocar, o `null` si su alcance es regional.
 *
 * Un obispo distrital sin distrito asignado es un dato inconsistente: se corta con 403 en vez de
 * devolver `null`, que se leería como "alcance regional" y le abriría la región entera.
 */
export function distritoDeAlcance(user: { rol: string; distritoId: number | null }): number | null {
  if (!esRolDistrital(user.rol)) return null;
  if (user.distritoId === null) {
    throw new ApiError(403, 'Tu usuario no tiene un distrito asignado. Pide al Responsable del sistema que lo configure.');
  }
  return user.distritoId;
}
