import { z } from 'zod';
import { emailField } from '../../utils/schemaHelpers';

// `null` explícito quita el distrito (p. ej. al pasar de obispo distrital a un rol regional); hace
// falta distinguirlo de la ausencia, que en un PUT parcial significa "no tocar".
const distritoIdField = z.preprocess(
  (v) => (v === '' ? null : v),
  z.number().int().positive('distritoId inválido').nullish(),
);

export const createUsuarioSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  email: emailField('email'),
  password: z.string().min(8, 'password debe tener al menos 8 caracteres'),
  rolId: z.number().int().positive('rolId es requerido'),
  estadoId: z.number().int().positive('estadoId es requerido'),
  distritoId: distritoIdField,
});

export const updateUsuarioSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  email: emailField('email'),
  password: z.string().min(8, 'password debe tener al menos 8 caracteres').optional(),
  rolId: z.number().int().positive().optional(),
  estadoId: z.number().int().positive().optional(),
  distritoId: distritoIdField,
});

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
