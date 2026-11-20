import PDFDocument from 'pdfkit';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/ApiError';
import { calcularResultado } from './resultados';

/**
 * Acta de la asamblea (PDF) y métricas para el informe (CSV), HU15.
 *
 * El acta lleva lo que una mesa firma en papel: quiénes estaban habilitados, cuántos votaron en
 * cada elección, cuántos votos recibió cada candidato y quién ganó. El CSV no lleva ningún dato
 * personal: solo tiempos y cantidades por elección, para medir la plataforma.
 */

async function datosAsamblea(asambleaId: number) {
  const a = await prisma.asamblea.findUnique({
    where: { id: asambleaId },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      fecha: true,
      estado: true,
      codigoAcceso: true,
      distrito: { select: { nombre: true } },
      elecciones: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          cargo: true,
          ronda: true,
          estado: true,
          abiertaEn: true,
          cerradaEn: true,
          publicadaEn: true,
          ganadorId: true,
          candidatos: { select: { id: true, nombre: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] },
          _count: { select: { emisiones: true, votos: true } },
        },
      },
    },
  });
  if (!a) throw new ApiError(404, 'Asamblea no encontrada');
  const [padron, acreditados, agrupado] = await Promise.all([
    prisma.elector.count({ where: { asambleaId } }),
    prisma.elector.count({ where: { asambleaId, acreditado: true } }),
    prisma.voto.groupBy({
      by: ['candidatoId'],
      where: { eleccion: { asambleaId } },
      _count: { _all: true },
    }),
  ]);
  const votosDe = new Map(agrupado.map((g) => [g.candidatoId, g._count._all]));
  return { ...a, padron, acreditados, votosDe };
}

const FECHA_HORA = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' });
const HORA = new Intl.DateTimeFormat('es-PE', { timeStyle: 'medium', timeZone: 'America/Lima' });
const fh = (d: Date | null) => (d ? FECHA_HORA.format(d) : '—');
const h = (d: Date | null) => (d ? HORA.format(d) : '—');

const AZUL = '#0f6b5c';
const GRIS = '#6b7268';

export async function generarActa(asambleaId: number): Promise<Buffer> {
  const a = await datosAsamblea(asambleaId);
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Acta — ${a.nombre}` } });
  const partes: Buffer[] = [];
  doc.on('data', (p: Buffer) => partes.push(p));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));
  const ancho = doc.page.width - 100;

  doc.fillColor(AZUL).fontSize(10).text('IGLESIA DE DIOS DEL PERÚ — REGIÓN NORTE CHICO', { align: 'center' });
  doc.moveDown(0.3).fillColor('#000').fontSize(18).text('ACTA DE VOTACIÓN ELECTRÓNICA', { align: 'center' });
  doc.moveDown(0.2).fontSize(13).text(a.nombre, { align: 'center' });
  doc.moveDown(1).fontSize(10).fillColor('#000');
  doc.text(`Fecha de la asamblea: ${fh(a.fecha)}`);
  doc.text(`Tipo: ${a.tipo === 'REGIONAL' ? 'Regional' : `Distrital — ${a.distrito?.nombre ?? ''}`}`);
  doc.text(`Código de acceso: ${a.codigoAcceso}    Estado: ${a.estado.replace('_', ' ').toLowerCase()}`);
  doc.text(`Electores en el padrón: ${a.padron}    Acreditados: ${a.acreditados}`);
  doc.moveDown(0.8);

  for (const e of a.elecciones) {
    if (doc.y > doc.page.height - 220) doc.addPage();
    doc.moveTo(50, doc.y).lineTo(50 + ancho, doc.y).strokeColor('#e5e1d8').stroke();
    doc.moveDown(0.5);
    doc.fillColor(AZUL).fontSize(13).text(`${e.cargo}${e.ronda > 1 ? ` — segunda vuelta (ronda ${e.ronda})` : ''}`);
    doc.fillColor(GRIS).fontSize(9).text(
      `Apertura: ${h(e.abiertaEn)}   Cierre: ${h(e.cerradaEn)}   Publicación: ${h(e.publicadaEn)}   ` +
        `Votaron: ${e._count.emisiones} de ${a.acreditados} acreditados`,
    );
    doc.moveDown(0.4).fillColor('#000').fontSize(10);

    const conteo = e.candidatos.map((c) => ({ ...c, votos: a.votosDe.get(c.id) ?? 0 }));
    const total = conteo.reduce((s, c) => s + c.votos, 0);
    for (const c of conteo) {
      const y = doc.y;
      doc.text(c.nombre + (c.id === e.ganadorId ? '   (GANADOR)' : ''), 60, y, { width: ancho - 140 });
      doc.text(`${c.votos} voto${c.votos === 1 ? '' : 's'}`, 50 + ancho - 130, y, { width: 70, align: 'right' });
      doc.text(total ? `${((c.votos / total) * 100).toFixed(1)} %` : '—', 50 + ancho - 55, y, { width: 55, align: 'right' });
      doc.moveDown(0.2);
    }
    doc.moveDown(0.3).fontSize(10);
    if (e.estado !== 'CERRADA') {
      doc.fillColor(GRIS).text(`Estado: ${e.estado.toLowerCase()} (sin resultado).`, 50);
    } else if (e.ganadorId) {
      const ganador = e.candidatos.find((c) => c.id === e.ganadorId)?.nombre ?? '';
      doc.fillColor('#000').text(`Resultado: resulta electo(a) ${ganador} con ${a.votosDe.get(e.ganadorId) ?? 0} de ${total} votos.`, 50);
    } else {
      const { empatados } = calcularResultado(conteo.map((c) => ({ candidatoId: c.id, votos: c.votos })));
      const nombres = conteo.filter((c) => empatados.includes(c.id)).map((c) => c.nombre).join(', ');
      doc.fillColor('#000').text(`Resultado: empate entre ${nombres}. Se convoca a segunda vuelta.`, 50);
    }
    // Coherencia del registro: cada emisión tiene exactamente un voto.
    if (e._count.emisiones !== e._count.votos) {
      doc.fillColor('#b3261e').text(`ATENCIÓN: ${e._count.emisiones} emisiones y ${e._count.votos} votos no coinciden.`, 50);
    }
    doc.moveDown(0.8).fillColor('#000');
  }

  if (doc.y > doc.page.height - 200) doc.addPage();
  doc.moveDown(1).fontSize(9).fillColor(GRIS).text(
    'El voto es secreto: el sistema registra por separado quién votó y los votos, sin ningún dato que permita ' +
      'relacionarlos. Documento generado por la plataforma de votación electrónica de iddprenoch.com el ' +
      `${fh(new Date())}.`,
    50,
    doc.y,
    { width: ancho },
  );
  doc.moveDown(4).fillColor('#000').fontSize(10);
  const yFirmas = doc.y;
  const anchoFirma = (ancho - 40) / 3;
  ['Presidente(a) de mesa', 'Secretario(a)', 'Testigo'].forEach((rol, i) => {
    const x = 50 + i * (anchoFirma + 20);
    doc.moveTo(x, yFirmas).lineTo(x + anchoFirma, yFirmas).strokeColor('#000').stroke();
    doc.text(rol, x, yFirmas + 5, { width: anchoFirma, align: 'center' });
  });

  doc.end();
  return fin;
}

/** Fecha en ISO con la zona de Lima (UTC-5, sin horario de verano): legible y ordenable. */
function isoLima(d: Date | null): string {
  if (!d) return '';
  return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().replace('Z', '-05:00');
}

function celda(valor: string | number): string {
  const texto = String(valor);
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Métricas por elección, SIN datos personales (ni electores ni candidatos): apertura, cierre,
 * publicación, segundos entre cierre y publicación, emisiones y votos contabilizados.
 */
export async function generarMetricasCsv(asambleaId: number): Promise<string> {
  const a = await datosAsamblea(asambleaId);
  const encabezado = [
    'eleccion_id',
    'cargo',
    'ronda',
    'estado',
    'abierta_en',
    'cerrada_en',
    'publicada_en',
    'segundos_votacion',
    'segundos_cierre_a_publicacion',
    'acreditados',
    'emisiones',
    'votos_contabilizados',
    'participacion_pct',
  ];
  const filas = a.elecciones.map((e) => {
    const seg = (desde: Date | null, hasta: Date | null) =>
      desde && hasta ? Math.round((hasta.getTime() - desde.getTime()) / 1000) : '';
    return [
      e.id,
      e.cargo,
      e.ronda,
      e.estado,
      isoLima(e.abiertaEn),
      isoLima(e.cerradaEn),
      isoLima(e.publicadaEn),
      seg(e.abiertaEn, e.cerradaEn),
      seg(e.cerradaEn, e.publicadaEn),
      a.acreditados,
      e._count.emisiones,
      e._count.votos,
      a.acreditados ? ((e._count.emisiones / a.acreditados) * 100).toFixed(1) : '',
    ].map(celda);
  });
  // BOM: sin él, Excel en Windows abre el UTF-8 como Latin-1 y rompe las tildes de los cargos.
  return '﻿' + [encabezado.join(','), ...filas.map((f) => f.join(','))].join('\r\n') + '\r\n';
}
