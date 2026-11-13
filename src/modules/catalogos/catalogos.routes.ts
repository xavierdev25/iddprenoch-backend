import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { prisma } from '../../db/prisma';
import { buildCatalogHandler } from '../../utils/catalogFactory';
import { asyncHandler } from '../../utils/asyncHandler';
import { permisosDe } from '../../utils/permisos';

// Catálogos de solo lectura para poblar <select> del panel admin (Congregantes, Usuarios).
// Sin paginación (listas cortas y fijas) y sin CRUD (se gestionan por seed, no desde la UI).
export const catalogosRouter = Router();

catalogosRouter.use(requireAuth);

catalogosRouter.get('/sexo', buildCatalogHandler(prisma.sexo));
catalogosRouter.get('/estado-civil', buildCatalogHandler(prisma.estadoCivil));
catalogosRouter.get('/estado-eclesial', buildCatalogHandler(prisma.estadoEclesial));
// Solo los roles asignables: Secretario y Tesorero Regional siguen en la tabla (existían en
// producción y no se borran), pero sin permisos asignarlos dejaría a la cuenta sin acceso a nada.
catalogosRouter.get(
  '/roles',
  asyncHandler(async (_req, res) => {
    const roles = await prisma.rol.findMany({ orderBy: { nombre: 'asc' } });
    res.json(roles.filter((r) => permisosDe(r.nombre).length > 0));
  }),
);
catalogosRouter.get('/estados-usuario', buildCatalogHandler(prisma.estadoUsuario));
