import { z } from 'zod';

export const loginSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido'),
  password: z.string().min(1, 'password es requerido'),
});

export type LoginInput = z.infer<typeof loginSchema>;
