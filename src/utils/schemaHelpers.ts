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
