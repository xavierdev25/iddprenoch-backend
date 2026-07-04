import { z } from 'zod';
import { dniField, emailField, idField, urlField } from '../../utils/schemaHelpers';

export const createCongreganteSchema = z.object({
  dni: dniField,
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  apellido: z.string().min(1, 'apellido es requerido').max(255),
  telefono: z.string().max(20).optional(),
  correo: emailField('correo'),
  foto: urlField('foto'),
  iglesiaId: idField('iglesiaId'),
  sexoId: idField('sexoId'),
  estadoCivilId: idField('estadoCivilId'),
  estadoEclesialId: idField('estadoEclesialId'),
  fechaConversion: z.coerce.date().optional(),
  fechaBautismo: z.coerce.date().optional(),
});

export const updateCongreganteSchema = createCongreganteSchema.partial();
