import { z } from 'zod';
import { buildCrudController } from '../../utils/crudFactory';
import { auditoriaService } from './auditoria.service';
import { construirWhereAuditoria, parseFiltrosAuditoria } from './auditoria.schema';

// La auditoría es de solo lectura: el factory exige esquemas de alta/edición, pero las rutas
// correspondientes no se montan (ver auditoria.routes.ts).
const sinEscritura = z.never();

export const auditoriaController = buildCrudController(auditoriaService, {
  createSchema: sinEscritura,
  updateSchema: sinEscritura,
  parseListFilters: (query) => construirWhereAuditoria(parseFiltrosAuditoria(query)),
});
