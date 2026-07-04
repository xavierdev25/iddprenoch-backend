import { z } from 'zod';
import { emailField } from '../../utils/schemaHelpers';

export const createUsuarioSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  email: emailField('email'),
  password: z.string().min(8, 'password debe tener al menos 8 caracteres'),
  rolId: z.number().int().positive('rolId es requerido'),
  estadoId: z.number().int().positive('estadoId es requerido'),
});

export const updateUsuarioSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  email: emailField('email'),
  password: z.string().min(8, 'password debe tener al menos 8 caracteres').optional(),
  rolId: z.number().int().positive().optional(),
  estadoId: z.number().int().positive().optional(),
});
