import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { auditar } from '../../utils/auditoria';
import { distritoDe, whereRelacionIglesiaEnAlcance } from '../../utils/alcance';
import { parseId, parsePagination } from '../../utils/crudFactory';
import { ROLES } from '../../utils/permisos';
import { exigirAsambleaEnAlcance, whereAsambleasEnAlcance } from './asambleas.alcance';
import {
  acreditarSchema,
  actualizarAsambleaSchema,
  actualizarCandidatoSchema,
  asambleaSchema,
  candidatoSchema,
  eleccionSchema,
  electorSchema,
  importarPadronSchema,
  parse,
} from './asambleas.schema';
import * as service from './asambleas.service';
import * as conduccion from './conduccion.service';
import { generarActa, generarMetricasCsv } from './acta';

/** Carga la asamblea de la ruta y exige que esté en el alcance del usuario. */
async function asambleaDeLaRuta(req: Request) {
  const asamblea = await service.cabecera(parseId(req));
  await exigirAsambleaEnAlcance(req, asamblea);
  return asamblea;
}

async function eleccionDeLaRuta(req: Request) {
  const eleccion = await service.cabeceraEleccion(parseId(req));
  await exigirAsambleaEnAlcance(req, eleccion.asamblea);
  return eleccion;
}

async function candidatoDeLaRuta(req: Request) {
  const candidato = await service.cabeceraCandidato(parseId(req));
  await exigirAsambleaEnAlcance(req, candidato.eleccion.asamblea);
  return candidato;
}

export const asambleasController = {
  listar: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req);
    res.json(await service.listar(whereAsambleasEnAlcance(req), page, limit));
  }),

  detalle: asyncHandler(async (req: Request, res: Response) => {
    await asambleaDeLaRuta(req);
    res.json(await service.detalle(parseId(req)));
  }),

  crear: asyncHandler(async (req: Request, res: Response) => {
    const datos = parse(asambleaSchema, req.body);
    // El obispo distrital solo crea asambleas distritales de su propio distrito.
    await exigirAsambleaEnAlcance(req, { tipo: datos.tipo, distritoId: datos.distritoId ?? null });
    const asamblea = await service.crear(datos);
    await auditar(req, 'CREAR ASAMBLEA', 'PERMITIDO', `id=${asamblea.id} "${asamblea.nombre}"`);
    res.status(201).json(asamblea);
  }),

  actualizar: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    if (asamblea.estado === 'FINALIZADA') throw new ApiError(409, 'La asamblea ya finalizó: no admite cambios.');
    res.json(await service.actualizar(asamblea.id, parse(actualizarAsambleaSchema, req.body)));
  }),

  eliminar: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const forzar = req.query.forzar === '1';
    if (forzar && req.user!.rol !== ROLES.RESPONSABLE) {
      throw new ApiError(403, 'Solo el Responsable del sistema puede eliminar una asamblea con votos.');
    }
    await service.eliminar(asamblea.id, forzar);
    await auditar(req, 'ELIMINAR ASAMBLEA', 'PERMITIDO', `"${asamblea.nombre}"${forzar ? ' (forzado, con votos)' : ''}`);
    res.status(204).send();
  }),

  // ── Elecciones ──
  crearEleccion: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    res.status(201).json(await service.crearEleccion(asamblea, parse(eleccionSchema, req.body).cargo));
  }),

  actualizarEleccion: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    res.json(await service.actualizarEleccion(eleccion, parse(eleccionSchema, req.body).cargo));
  }),

  eliminarEleccion: asyncHandler(async (req: Request, res: Response) => {
    await service.eliminarEleccion(await eleccionDeLaRuta(req));
    res.status(204).send();
  }),

  // ── Candidatos ──
  crearCandidato: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    res.status(201).json(await service.crearCandidato(eleccion, parse(candidatoSchema, req.body)));
  }),

  actualizarCandidato: asyncHandler(async (req: Request, res: Response) => {
    const candidato = await candidatoDeLaRuta(req);
    res.json(await service.actualizarCandidato(candidato.id, candidato.eleccion.estado, parse(actualizarCandidatoSchema, req.body)));
  }),

  eliminarCandidato: asyncHandler(async (req: Request, res: Response) => {
    const candidato = await candidatoDeLaRuta(req);
    await service.eliminarCandidato(candidato.id, candidato.eleccion.estado);
    res.status(204).send();
  }),

  /**
   * Pública y cacheable: la usan la cédula, el panel y la proyección. La foto de un candidato no
   * es reservada (se proyecta en la asamblea) y servirla como imagen, no como base64 dentro de un
   * JSON, deja que el navegador la cachee y la pida una sola vez.
   */
  fotoCandidato: asyncHandler(async (req: Request, res: Response) => {
    const foto = await service.fotoCandidato(parseId(req));
    if (!foto) throw new ApiError(404, 'Sin foto');
    res.set({ 'Cache-Control': 'public, max-age=3600', ETag: foto.etag, 'Cross-Origin-Resource-Policy': 'same-site' });
    if (req.get('if-none-match') === foto.etag) {
      res.status(304).end();
      return;
    }
    res.type(foto.tipo).send(foto.datos);
  }),

  // ── Padrón y acreditación ──
  listarElectores: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const { page, limit } = parsePagination(req);
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim().slice(0, 100) : undefined;
    res.json(await service.listarElectores(asamblea.id, q, page, limit));
  }),

  agregarElector: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    res.status(201).json(await service.agregarElector(asamblea, parse(electorSchema, req.body)));
  }),

  eliminarElector: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const electorId = Number(req.params.electorId);
    if (!Number.isInteger(electorId)) throw new ApiError(400, 'electorId inválido');
    await service.eliminarElector(asamblea.id, electorId);
    res.status(204).send();
  }),

  importarPadron: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const filtro = parse(importarPadronSchema, req.body);
    // En una asamblea distrital, solo congregantes de ese distrito, lo pida quien lo pida.
    if (asamblea.tipo === 'DISTRITAL') {
      if (filtro.distritoId && filtro.distritoId !== asamblea.distritoId) {
        throw new ApiError(400, 'Una asamblea distrital solo admite electores de su distrito.');
      }
      filtro.distritoId = asamblea.distritoId!;
    }
    const resultado = await service.importarPadron(asamblea, filtro, whereRelacionIglesiaEnAlcance(req));
    await auditar(req, 'IMPORTAR PADRON', 'PERMITIDO', `asamblea=${asamblea.id} agregados=${resultado.agregados}`);
    res.json(resultado);
  }),

  buscarDni: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const dni = String(req.params.dni);
    if (!/^\d{8}$/.test(dni)) throw new ApiError(400, 'dni debe tener 8 dígitos');
    // La sugerencia sale de la membresía: se respeta el alcance de quien opera la mesa.
    const alcance = whereRelacionIglesiaEnAlcance(req);
    const distritoAsamblea = asamblea.tipo === 'DISTRITAL' ? { iglesia: { distritoId: asamblea.distritoId } } : {};
    res.json(await service.buscarDni(asamblea.id, dni, distritoDe(req) === null ? distritoAsamblea : alcance));
  }),

  // ── Conducción (Sprint 3) ──
  conteo: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    res.set('Cache-Control', 'no-store').json(await conduccion.conteo(eleccion.id));
  }),

  abrir: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    const r = await conduccion.abrir(eleccion.id);
    await auditar(req, 'ABRIR VOTACION', 'PERMITIDO', `"${eleccion.cargo}" ronda ${eleccion.ronda}`);
    res.json(r);
  }),

  cerrar: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    const r = await conduccion.cerrar(eleccion.id);
    await auditar(req, 'CERRAR VOTACION', 'PERMITIDO', `"${eleccion.cargo}" ronda ${eleccion.ronda}: ${r.emisiones} votos`);
    res.json(r);
  }),

  segundaVuelta: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    const r = await conduccion.segundaVuelta(eleccion.id);
    await auditar(req, 'SEGUNDA VUELTA', 'PERMITIDO', `"${eleccion.cargo}" ronda ${r.ronda}`);
    res.status(201).json(r);
  }),

  publicar: asyncHandler(async (req: Request, res: Response) => {
    const eleccion = await eleccionDeLaRuta(req);
    const r = await conduccion.publicar(eleccion.id);
    await auditar(req, 'PUBLICAR RESULTADO', 'PERMITIDO', `"${eleccion.cargo}" ronda ${eleccion.ronda}`);
    res.json(r);
  }),

  finalizar: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    await conduccion.finalizar(asamblea.id);
    await auditar(req, 'FINALIZAR ASAMBLEA', 'PERMITIDO', `"${asamblea.nombre}"`);
    res.json({ ok: true });
  }),

  acta: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const pdf = await generarActa(asamblea.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acta-${asamblea.codigoAcceso}.pdf"`,
      'Cache-Control': 'no-store',
    });
    res.end(pdf);
  }),

  metricas: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="metricas-${asamblea.codigoAcceso}.csv"`,
      'Cache-Control': 'no-store',
    });
    res.send(await generarMetricasCsv(asamblea.id));
  }),

  acreditar: asyncHandler(async (req: Request, res: Response) => {
    const asamblea = await asambleaDeLaRuta(req);
    const { dni, regenerar } = parse(acreditarSchema, req.body);
    const resultado = await service.acreditar(asamblea, dni, regenerar);
    // Regenerar invalida un código ya entregado: queda registro de quién lo hizo.
    if (resultado.regenerado) {
      await auditar(req, 'REGENERAR CODIGO ELECTOR', 'PERMITIDO', `asamblea=${asamblea.id} elector=${resultado.elector.id}`);
    }
    res.set('Cache-Control', 'no-store').json(resultado);
  }),
};
