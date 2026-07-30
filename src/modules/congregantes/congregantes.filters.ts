import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { CLAVES_GRUPO_ETARIO, GrupoEtario, rangoFechaNacimiento } from '../../utils/edad';

/**
 * Filtros compartidos por el listado de congregantes y por el módulo de reportes. Viven aquí, en
 * una sola pieza, para que la lista que ve el administrador en pantalla y el Excel/PDF que
 * descarga con los mismos filtros no puedan divergir.
 */

/**
 * Query param numérico opcional; `''` (select sin elegir) cuenta como ausente, no como 0.
 *
 * Los mensajes se escriben a mano porque los de Zod salen en inglés y estos llegan tal cual a la
 * pantalla del administrador, junto al resto de errores de la API, que están en castellano.
 */
// Los mensajes no repiten el nombre del campo: quien los formatea ya lo antepone (`iglesiaId: …`).
const idOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z.coerce
    .number({ error: 'debe ser un número' })
    .int('debe ser un número entero')
    .positive('debe ser mayor que cero')
    .optional(),
);

export const congregantesFiltrosSchema = z.object({
  iglesiaId: idOpcional,
  distritoId: idOpcional,
  ministerioId: idOpcional,
  sexoId: idOpcional,
  estadoCivilId: idOpcional,
  estadoEclesialId: idOpcional,
  grupoEtario: z
    .enum(CLAVES_GRUPO_ETARIO as [GrupoEtario, ...GrupoEtario[]], {
      error: `debe ser uno de: ${CLAVES_GRUPO_ETARIO.join(', ')}`,
    })
    .optional(),
  /** Búsqueda libre por nombre, apellido o DNI. */
  q: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().trim().max(100, 'no puede superar 100 caracteres').optional(),
  ),
});

export type CongregantesFiltros = z.infer<typeof congregantesFiltrosSchema>;

/**
 * Traduce los filtros a un `where` de Prisma.
 *
 * El grupo etario se resuelve como un rango de `fechaNacimiento` en SQL (ver
 * {@link rangoFechaNacimiento}) en vez de traer todos los congregantes y clasificarlos en Node:
 * así la paginación y los totales del reporte siguen siendo consultas indexadas.
 */
export function construirWhereCongregantes(filtros: CongregantesFiltros): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filtros.iglesiaId) where.iglesiaId = filtros.iglesiaId;
  if (filtros.ministerioId) where.ministerioId = filtros.ministerioId;
  if (filtros.sexoId) where.sexoId = filtros.sexoId;
  if (filtros.estadoCivilId) where.estadoCivilId = filtros.estadoCivilId;
  if (filtros.estadoEclesialId) where.estadoEclesialId = filtros.estadoEclesialId;

  // El distrito no está en congregantes: se filtra a través de la iglesia, que es su única fuente.
  if (filtros.distritoId) where.iglesia = { distritoId: filtros.distritoId };

  if (filtros.grupoEtario === 'sin_fecha') {
    where.fechaNacimiento = null;
  } else if (filtros.grupoEtario) {
    where.fechaNacimiento = rangoFechaNacimiento(filtros.grupoEtario);
  }

  // Las colaciones por defecto de MySQL (utf8mb4_*_ci) ya ignoran mayúsculas, y Prisma no admite
  // `mode: 'insensitive'` en MySQL, así que `contains` basta.
  if (filtros.q) {
    where.OR = [
      { nombre: { contains: filtros.q } },
      { apellido: { contains: filtros.q } },
      { dni: { contains: filtros.q } },
    ];
  }

  return where;
}

/**
 * Parsea los query params crudos de Express.
 *
 * Un filtro inválido corta con 400 en vez de ignorarse: si `grupoEtario=jovenes` (mal escrito) se
 * descartara en silencio, el reporte devolvería la membresía completa como si fuera el resultado
 * filtrado, y nadie leyendo el Excel notaría que el filtro nunca se aplicó.
 */
export function parseFiltrosCongregantes(query: unknown): CongregantesFiltros {
  const result = congregantesFiltrosSchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    const campo = issue?.path.map(String).join('.') || 'filtro';
    throw new ApiError(400, `${campo}: ${issue?.message ?? 'valor inválido'}`);
  }
  return result.data;
}
