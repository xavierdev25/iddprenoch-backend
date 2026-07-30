import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { congregantesFiltrosSchema } from '../congregantes/congregantes.filters';

/** Nivel de agregación del reporte consolidado. */
export const AGRUPACIONES = ['iglesia', 'distrito'] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number];

export const reporteQuerySchema = congregantesFiltrosSchema.extend({
  agruparPor: z
    .enum(AGRUPACIONES, { error: `debe ser uno de: ${AGRUPACIONES.join(', ')}` })
    .default('iglesia'),
});

export type ReporteQuery = z.infer<typeof reporteQuerySchema>;

/** Mismo criterio que los filtros de congregantes: un parámetro inválido corta con 400 en vez de
 * ignorarse, para que nadie lea un reporte creyendo que salió filtrado cuando no lo está. */
export function parseReporteQuery(query: unknown): ReporteQuery {
  const result = reporteQuerySchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    const campo = issue?.path.map(String).join('.') || 'parámetro';
    throw new ApiError(400, `${campo}: ${issue?.message ?? 'valor inválido'}`);
  }
  return result.data;
}
