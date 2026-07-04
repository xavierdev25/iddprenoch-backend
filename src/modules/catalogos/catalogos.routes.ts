import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { prisma } from '../../db/prisma';
import { buildCatalogHandler } from '../../utils/catalogFactory';

// Catálogos de solo lectura para poblar <select> del panel admin (Congregantes, Usuarios).
// Sin paginación (listas cortas y fijas) y sin CRUD (se gestionan por seed, no desde la UI).
export const catalogosRouter = Router();

catalogosRouter.use(requireAuth);

catalogosRouter.get('/sexo', buildCatalogHandler(prisma.sexo));
catalogosRouter.get('/estado-civil', buildCatalogHandler(prisma.estadoCivil));
catalogosRouter.get('/estado-eclesial', buildCatalogHandler(prisma.estadoEclesial));
catalogosRouter.get('/roles', buildCatalogHandler(prisma.rol));
catalogosRouter.get('/estados-usuario', buildCatalogHandler(prisma.estadoUsuario));
