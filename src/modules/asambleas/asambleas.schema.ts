import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { formatZodError } from '../../utils/crudFactory';
import { dniField, idOpcionalField } from '../../utils/schemaHelpers';

const vacioANull = (v: unknown) => (v === '' ? null : v);

export const asambleaSchema = z
  .object({
    nombre: z.string().trim().min(3, 'debe tener al menos 3 caracteres').max(191),
    tipo: z.enum(['REGIONAL', 'DISTRITAL'], { error: 'debe ser REGIONAL o DISTRITAL' }),
    distritoId: z.preprocess(vacioANull, z.coerce.number().int().positive().nullish()),
    fecha: z.coerce.date({ error: 'fecha inválida' }),
  })
  // Una asamblea distrital sin distrito no tendría a quién acotar; una regional con distrito
  // se leería como distrital por error. Se exige la combinación correcta.
  .refine((a) => (a.tipo === 'DISTRITAL' ? Boolean(a.distritoId) : !a.distritoId), {
    path: ['distritoId'],
    message: 'es obligatorio en una asamblea distrital y debe quedar vacío en una regional',
  });

export const actualizarAsambleaSchema = z.object({
  nombre: z.string().trim().min(3).max(191).optional(),
  fecha: z.coerce.date({ error: 'fecha inválida' }).optional(),
});

export const eleccionSchema = z.object({
  cargo: z.string().trim().min(2, 'debe tener al menos 2 caracteres').max(191),
});

/**
 * Foto del candidato: data URL de imagen (mismo patrón base64 que el resto del repo). El panel la
 * reduce a ~480 px antes de subirla; el tope de 1,5 MB evita que una foto sin reducir viaje a 200
 * celulares a la vez al abrirse la elección.
 */
const fotoCandidato = z.preprocess(
  vacioANull,
  z
    .string()
    .max(1_500_000, 'la foto es demasiado pesada (máx. 1 MB)')
    .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, 'debe ser una imagen PNG, JPG o WEBP')
    .nullish(),
);

export const candidatoSchema = z.object({
  nombre: z.string().trim().min(3, 'debe tener al menos 3 caracteres').max(191),
  detalle: z.preprocess(vacioANull, z.string().trim().max(191).nullish()),
  foto: fotoCandidato,
  orden: z.coerce.number().int().min(0).max(999).optional(),
});

export const actualizarCandidatoSchema = candidatoSchema.partial();

export const electorSchema = z.object({
  dni: dniField.regex(/^\d{8}$/, 'dni debe tener 8 dígitos'),
  nombre: z.string().trim().min(3, 'debe tener al menos 3 caracteres').max(191),
  iglesiaId: idOpcionalField,
});

export const importarPadronSchema = z
  .object({
    iglesiaId: idOpcionalField,
    distritoId: idOpcionalField,
    /** Solo bautizados: el estatuto habitual de las asambleas. Desmarcable desde el panel. */
    soloBautizados: z.boolean().default(true),
  })
  .refine((v) => v.iglesiaId || v.distritoId, { message: 'elige una iglesia o un distrito' });

export const acreditarSchema = z.object({
  dni: dniField.regex(/^\d{8}$/, 'dni debe tener 8 dígitos'),
  /** El elector ya acreditado perdió su código: se genera otro y el anterior deja de servir. */
  regenerar: z.boolean().optional(),
});

export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, formatZodError(result.error));
  return result.data;
}
