import { z } from 'zod';
import { idField, urlField } from '../../utils/schemaHelpers';

export const createPastorSchema = z.object({
  nombrePastor: z.string().min(1, 'nombrePastor es requerido').max(255),
  celular: z.string().max(20).optional(),
  iglesiaId: idField('iglesiaId'),
  cargoId: idField('cargoId'),
  foto: urlField('foto'),
});

export const updatePastorSchema = createPastorSchema.partial();
