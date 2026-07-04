import { z } from 'zod';

export const createCargoSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
});

export const updateCargoSchema = createCargoSchema.partial();
