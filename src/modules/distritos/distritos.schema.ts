import { z } from 'zod';

export const createDistritoSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
});

export const updateDistritoSchema = createDistritoSchema.partial();
