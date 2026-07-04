import { z } from 'zod';
import { urlField } from '../../utils/schemaHelpers';

export const createComunicadoSchema = z.object({
  titulo: z.string().min(1, 'titulo es requerido').max(255),
  imagen: urlField('imagen'),
  descripcion: z.string().max(5000).optional(),
});

export const updateComunicadoSchema = createComunicadoSchema.partial();
