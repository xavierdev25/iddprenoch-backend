import { z } from 'zod';
import { dniField, emailField, idField } from '../../utils/schemaHelpers';

export const createLiderSchema = z.object({
  dni: dniField,
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  apellido: z.string().min(1, 'apellido es requerido').max(255),
  telefono: z.string().max(20).optional(),
  correo: emailField('correo'),
  ministerioId: idField('ministerioId'),
  iglesiaId: idField('iglesiaId'),
});

export const updateLiderSchema = createLiderSchema.partial();
