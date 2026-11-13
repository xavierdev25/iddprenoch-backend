import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { generarExcelMembresia, generarExcelNominal } from './reportes.excel';
import { generarPdfMembresia, generarPdfNominal } from './reportes.pdf';
import { obtenerReporteMembresia, obtenerReporteNominal } from './reportes.service';
import { ReporteQuery, parseReporteQuery } from './reportes.schema';
import { aplicarAlcanceAFiltros } from '../../utils/alcance';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TIPO_PDF = 'application/pdf';

/**
 * Nombre de archivo con la fecha, para que varias descargas no se sobreescriban en la carpeta de
 * descargas y se pueda comparar el mismo reporte entre meses.
 */
function nombreArchivo(base: string, extension: string): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return `${base}-${fecha}.${extension}`;
}

function enviarDescarga(res: Response, archivo: Buffer, nombre: string, tipo: string): void {
  res.setHeader('Content-Type', tipo);
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.setHeader('Content-Length', archivo.length);
  // Un reporte descargado es una foto del momento: si el navegador lo cachea, el administrador
  // vuelve a bajar el mismo archivo tras cargar nuevos congregantes y no ve el cambio.
  res.setHeader('Cache-Control', 'no-store');
  res.end(archivo);
}

/** Filtros del reporte con el alcance del usuario ya aplicado (el obispo distrital, a su distrito). */
function consulta(req: Request): Promise<ReporteQuery> {
  return aplicarAlcanceAFiltros(req, parseReporteQuery(req.query));
}

export const reportesController = {
  /** Consolidado por iglesia o distrito, en JSON, para pintar la pantalla de reportes. */
  membresia: asyncHandler(async (req: Request, res: Response) => {
    res.json(await obtenerReporteMembresia(await consulta(req)));
  }),

  membresiaExcel: asyncHandler(async (req: Request, res: Response) => {
    const query = await consulta(req);
    const archivo = await generarExcelMembresia(await obtenerReporteMembresia(query));
    enviarDescarga(res, archivo, nombreArchivo(`membresia-por-${query.agruparPor}`, 'xlsx'), TIPO_XLSX);
  }),

  membresiaPdf: asyncHandler(async (req: Request, res: Response) => {
    const query = await consulta(req);
    const archivo = await generarPdfMembresia(await obtenerReporteMembresia(query));
    enviarDescarga(res, archivo, nombreArchivo(`membresia-por-${query.agruparPor}`, 'pdf'), TIPO_PDF);
  }),

  /** Listado nominal en JSON. Sin paginar: es el mismo universo que la descarga. */
  miembros: asyncHandler(async (req: Request, res: Response) => {
    res.json(await obtenerReporteNominal(await consulta(req)));
  }),

  miembrosExcel: asyncHandler(async (req: Request, res: Response) => {
    const archivo = await generarExcelNominal(await obtenerReporteNominal(await consulta(req)));
    enviarDescarga(res, archivo, nombreArchivo('lista-de-miembros', 'xlsx'), TIPO_XLSX);
  }),

  miembrosPdf: asyncHandler(async (req: Request, res: Response) => {
    const archivo = await generarPdfNominal(await obtenerReporteNominal(await consulta(req)));
    enviarDescarga(res, archivo, nombreArchivo('lista-de-miembros', 'pdf'), TIPO_PDF);
  }),
};
