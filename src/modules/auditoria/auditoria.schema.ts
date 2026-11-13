import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';

const vacioAUndefined = (v: unknown) => (v === '' ? undefined : v);

export const auditoriaFiltrosSchema = z.object({
  resultado: z.preprocess(
    vacioAUndefined,
    z.enum(['PERMITIDO', 'DENEGADO'], { error: 'debe ser PERMITIDO o DENEGADO' }).optional(),
  ),
  usuarioId: z.preprocess(vacioAUndefined, z.coerce.number().int().positive('debe ser mayor que cero').optional()),
  /** Coincidencia parcial: `LOGIN`, `EDITAR`, `fuera de alcance`... */
  accion: z.preprocess(vacioAUndefined, z.string().trim().max(40).optional()),
  /** Fechas `YYYY-MM-DD`, ambas inclusive, en hora de Lima. */
  desde: z.preprocess(vacioAUndefined, z.iso.date('debe tener formato AAAA-MM-DD').optional()),
  hasta: z.preprocess(vacioAUndefined, z.iso.date('debe tener formato AAAA-MM-DD').optional()),
});

export type AuditoriaFiltros = z.infer<typeof auditoriaFiltrosSchema>;

// Perú no tiene horario de verano: el día civil de Lima es siempre UTC-5.
const OFFSET_LIMA = '-05:00';

export function construirWhereAuditoria(f: AuditoriaFiltros): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.resultado) where.resultado = f.resultado;
  if (f.usuarioId) where.usuarioId = f.usuarioId;
  if (f.accion) where.accion = { contains: f.accion };
  if (f.desde || f.hasta) {
    where.fecha = {
      ...(f.desde ? { gte: new Date(`${f.desde}T00:00:00.000${OFFSET_LIMA}`) } : {}),
      ...(f.hasta ? { lte: new Date(`${f.hasta}T23:59:59.999${OFFSET_LIMA}`) } : {}),
    };
  }
  return where;
}

export function parseFiltrosAuditoria(query: unknown): AuditoriaFiltros {
  const result = auditoriaFiltrosSchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, `${issue?.path.map(String).join('.') || 'filtro'}: ${issue?.message ?? 'valor inválido'}`);
  }
  return result.data;
}
