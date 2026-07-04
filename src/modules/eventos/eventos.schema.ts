import { z } from 'zod';
import { urlField } from '../../utils/schemaHelpers';

export const createEventoSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  fechaConHora: z.coerce.date({ message: 'fechaConHora inválida' }),
  ubicacion: z.string().max(500).optional(),
  imagen: urlField('imagen'),
  descripcion: z.string().max(5000).optional(),
});

export const updateEventoSchema = createEventoSchema.partial();
