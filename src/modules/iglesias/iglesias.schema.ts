import { z } from 'zod';
import { idField, urlField } from '../../utils/schemaHelpers';

export const createIglesiaSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  direccion: z.string().min(1, 'direccion es requerida').max(500),
  distritoId: idField('distritoId'),
  ministerioId: z.number().int().positive().optional(),
  foto: urlField('foto'),
});

export const updateIglesiaSchema = createIglesiaSchema.partial();
