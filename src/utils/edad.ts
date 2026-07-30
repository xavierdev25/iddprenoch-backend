/**
 * Edad y grupo etario de congregantes.
 *
 * El grupo etario no se almacena en la base de datos: se deriva de `fechaNacimiento` en cada
 * consulta. Un valor guardado se desincronizaría en silencio cada cumpleaños, y los reportes de
 * membresía se piden justamente para conocer la composición vigente de la congregación.
 */

/**
 * Zona horaria de referencia para "hoy". El servidor de hosting puede correr en UTC, y a partir
 * de las 19:00 de Perú la fecha UTC ya es la del día siguiente: sin fijar la zona, un cumpleaños
 * se adelantaría un día en los reportes de la tarde.
 */
export const TIMEZONE_REPORTES = 'America/Lima';

export type GrupoEtario = 'nino' | 'adolescente' | 'joven' | 'adulto' | 'sin_fecha';

export interface DefinicionGrupoEtario {
  clave: GrupoEtario;
  etiqueta: string;
  edadMin: number;
  /** `undefined` = sin límite superior (grupo abierto). */
  edadMax?: number;
}

/**
 * CORTES DE EDAD — única fuente de verdad, usada por el cálculo, los filtros SQL y los reportes.
 *
 * Son una convención administrativa, no un dato técnico: si la región maneja otros rangos (p. ej.
 * joven hasta 35), se cambia solo esta tabla y todo lo demás queda consistente.
 */
export const GRUPOS_ETARIOS: readonly DefinicionGrupoEtario[] = [
  { clave: 'nino', etiqueta: 'Niños', edadMin: 0, edadMax: 11 },
  { clave: 'adolescente', etiqueta: 'Adolescentes', edadMin: 12, edadMax: 17 },
  { clave: 'joven', etiqueta: 'Jóvenes', edadMin: 18, edadMax: 30 },
  { clave: 'adulto', etiqueta: 'Adultos', edadMin: 31 },
] as const;

/** Claves aceptadas como filtro, incluyendo el grupo de los que aún no tienen fecha registrada. */
export const CLAVES_GRUPO_ETARIO: readonly GrupoEtario[] = [
  ...GRUPOS_ETARIOS.map((g) => g.clave),
  'sin_fecha',
];

export function etiquetaGrupoEtario(clave: GrupoEtario): string {
  return GRUPOS_ETARIOS.find((g) => g.clave === clave)?.etiqueta ?? 'Sin fecha de nacimiento';
}

/** Fecha civil (año/mes/día) sin hora, el tipo con el que se compara una fecha de nacimiento. */
export interface FechaCivil {
  anio: number;
  mes: number;
  dia: number;
}

/** La fecha civil de hoy en {@link TIMEZONE_REPORTES}, independiente de la zona del servidor. */
export function fechaCivilHoy(ahora: Date = new Date()): FechaCivil {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_REPORTES,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: valor('year'), mes: valor('month'), dia: valor('day') };
}

/**
 * Prisma devuelve una columna `@db.Date` como Date a medianoche UTC. Hay que leerla con getters
 * UTC: con los locales, en una zona de offset negativo como Perú la fecha retrocede un día
 * (2000-05-10T00:00:00Z se lee como 9 de mayo).
 */
function aFechaCivil(fecha: Date): FechaCivil {
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate() };
}

/**
 * Edad cumplida en años. Devuelve `undefined` si no hay fecha registrada (no 0: son casos
 * distintos y un 0 contaría al congregante como niño en los reportes).
 */
export function calcularEdad(
  fechaNacimiento: Date | null | undefined,
  hoy: FechaCivil = fechaCivilHoy(),
): number | undefined {
  if (!fechaNacimiento) return undefined;

  const nacimiento = aFechaCivil(fechaNacimiento);
  let edad = hoy.anio - nacimiento.anio;

  // Descuenta un año si el cumpleaños aún no llegó en el año en curso.
  if (hoy.mes < nacimiento.mes || (hoy.mes === nacimiento.mes && hoy.dia < nacimiento.dia)) {
    edad -= 1;
  }

  // Una fecha futura (dato mal tipeado) daría negativo; se trata como desconocida en vez de
  // propagar una edad imposible a los totales del reporte.
  return edad < 0 ? undefined : edad;
}

export function clasificarGrupoEtario(edad: number | undefined): GrupoEtario {
  if (edad === undefined) return 'sin_fecha';
  const grupo = GRUPOS_ETARIOS.find(
    (g) => edad >= g.edadMin && (g.edadMax === undefined || edad <= g.edadMax),
  );
  return grupo?.clave ?? 'sin_fecha';
}

export function grupoEtarioDeFecha(
  fechaNacimiento: Date | null | undefined,
  hoy: FechaCivil = fechaCivilHoy(),
): GrupoEtario {
  return clasificarGrupoEtario(calcularEdad(fechaNacimiento, hoy));
}

/** Medianoche UTC de una fecha civil, el mismo formato en que Prisma guarda un `@db.Date`. */
function aFechaUTC({ anio, mes, dia }: FechaCivil): Date {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * Traduce un grupo etario a un rango de `fechaNacimiento` para filtrar en SQL, en vez de traer
 * todos los congregantes a memoria y clasificarlos en Node.
 *
 * Tener `edad >= edadMin` equivale a haber nacido a más tardar hoy menos `edadMin` años; tener
 * `edad <= edadMax`, a haber nacido después de hoy menos `edadMax + 1` años.
 *
 * Nota: restar años a un 29 de febrero cae en un año no bisiesto y JS lo corre al 1 de marzo, así
 * que en esos casos el límite se mueve un día — el mismo criterio que se usa legalmente para la
 * mayoría de edad.
 */
export function rangoFechaNacimiento(
  clave: GrupoEtario,
  hoy: FechaCivil = fechaCivilHoy(),
): { gt?: Date; lte?: Date } | null {
  const grupo = GRUPOS_ETARIOS.find((g) => g.clave === clave);
  if (!grupo) return null;

  const rango: { gt?: Date; lte?: Date } = {
    lte: aFechaUTC({ ...hoy, anio: hoy.anio - grupo.edadMin }),
  };
  if (grupo.edadMax !== undefined) {
    rango.gt = aFechaUTC({ ...hoy, anio: hoy.anio - (grupo.edadMax + 1) });
  }
  return rango;
}
