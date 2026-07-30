import { z } from 'zod';

/** Positive integer FK reference, e.g. iglesiaId, cargoId. Repeated across every module's create schema. */
export function idField(fieldName: string) {
  return z.number().int().positive(`${fieldName} es requerido`);
}

// Los forms del frontend mandan '' (no `undefined`) en campos opcionales sin tocar. Sin este
// preprocess, `.email()/.url().optional()` rechaza ese '' por no ser un email/URL válido, aunque
// el campo sea opcional — bloqueando el caso más común (crear sin foto/correo todavía).
const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val);

/** Optional image/URL field, e.g. foto, imagen. Repeated across congregantes, pastores, iglesias, eventos, comunicados. */
export function urlField(fieldName: string) {
  return z.preprocess(emptyToUndefined, z.string().url(`${fieldName} debe ser una URL válida`).optional());
}

/** Optional email field, e.g. correo, email. Repeated across congregantes, lideres, usuarios. */
export function emailField(fieldName: string) {
  return z.preprocess(emptyToUndefined, z.string().email(`${fieldName} inválido`).optional());
}

/** 8-character DNI, shared by congregantes and lideres. */
export const dniField = z.string().length(8, 'dni debe tener 8 caracteres');

/** Optional FK reference, e.g. ministerioId. Same '' handling as the other optional fields. */
export const idOpcionalField = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

// Año mínimo plausible para una persona viva. Una fecha anterior es un tipeo (p. ej. 1090 por
// 1990), y pasa desapercibida en el formulario pero deforma los promedios de edad del reporte.
const ANIO_NACIMIENTO_MINIMO = 1900;

/**
 * Fecha de nacimiento. De ella se deriva la edad y el grupo etario del congregante, así que se
 * validan los dos extremos: una fecha futura o imposiblemente antigua produciría un grupo etario
 * inventado en todos los reportes de membresía.
 */
export const fechaNacimientoField = z.preprocess(
  emptyToUndefined,
  z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now(), 'fechaNacimiento no puede ser una fecha futura')
    .refine(
      (d) => d.getUTCFullYear() >= ANIO_NACIMIENTO_MINIMO,
      `fechaNacimiento no puede ser anterior a ${ANIO_NACIMIENTO_MINIMO}`,
    )
    .optional(),
);
