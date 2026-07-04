import { z } from 'zod';

export const createMinisterioSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  slug: z.string().min(1).max(100).optional(),
  descripcion: z.string().max(2000).optional(),
});

export const updateMinisterioSchema = createMinisterioSchema.partial();
